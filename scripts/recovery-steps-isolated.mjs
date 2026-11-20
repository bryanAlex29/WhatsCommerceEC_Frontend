/** Pure mobile client + real Nest/PG17/Redis7. Synthetic DB codes, NO email/native UI/DEV. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import ts from 'typescript';

const backend = process.env.BACKEND_DIR || fileURLToPath(new URL('../../WhatsCommerceEC_Backend_Subfase1_5/', import.meta.url));
const requireBackend = createRequire(path.join(backend, 'package.json'));
async function dependency(name) { const module = await import(pathToFileURL(requireBackend.resolve(name)).href); return { ...module.default, ...module }; }
const compiled = file => import(pathToFileURL(path.join(backend, 'dist', file)).href);
const mobileSource = new URL('../src/', import.meta.url).href;
const password = randomBytes(32).toString('base64url'); const runtimePassword = randomBytes(32).toString('base64url');
const prefix = `wc-recovery-steps-${randomUUID().slice(0, 8)}`;
const started = []; const pools = []; const clients = [];
let step = 'setup'; let checks = 0; let app; let redis; let hooks;
const check = (condition, label) => { step = label; assert.ok(condition); checks++; };
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  env: { ...process.env, POSTGRES_PASSWORD: password } }).trim();
function container(suffix, image, target, extra = []) {
  const name = `${prefix}-${suffix}`; docker(['run', '--rm', '-d', '--name', name, '-p', `127.0.0.1::${target}`, ...extra, image]); started.push(name);
  const binding = /^127\.0\.0\.1:(\d+)$/.exec(docker(['port', name, `${target}/tcp`])); assert.ok(binding); return Number(binding[1]);
}
try {
  process.env.NODE_ENV = 'test';
  check(!process.env.DOCKER_HOST && !process.env.DOCKER_CONTEXT && !process.env.DOCKER_TLS_VERIFY && !process.env.DOCKER_CERT_PATH, 'local_docker_only');
  const context = JSON.parse(docker(['context', 'inspect']));
  check(context.length === 1 && /^(npipe:\/\/\/|unix:\/\/\/)/.test(context[0]?.Endpoints?.docker?.Host ?? ''), 'local_engine');
  await dependency('reflect-metadata');
  const { Pool } = await dependency('pg'); const { PrismaPg } = await dependency('@prisma/adapter-pg');
  const { Redis } = await dependency('ioredis'); const { Test } = await dependency('@nestjs/testing');
  const { PrismaClient } = await compiled('generated/prisma/client.js');
  const { AccessTokens, hashPassword, verifyPassword } = await compiled('modules/auth/crypto.js');
  const { CompanyCursor } = await compiled('modules/auth/cursor.js');
  const { PrismaIdentityPort } = await compiled('modules/auth/persistence/adapters.js');
  const { PrismaRecoveryPort } = await compiled('modules/auth/persistence/recovery-adapter.js');
  const { RecoveryCrypto, RecoveryService, recoveryMessage } = await compiled('modules/auth/recovery.js');
  const { AuthService } = await compiled('modules/auth/auth.service.js');
  const { RedisRateLimits } = await compiled('modules/auth/rate-limit.js');
  const { AuthRuntime } = await compiled('modules/auth/runtime.js'); const { AuthModule } = await compiled('modules/auth/auth.module.js');
  const { authJsonMiddleware } = await compiled('modules/auth/strict-json.js');
  step = 'containers'; const pgPort = container('pg', 'postgres:17-alpine', 5432, ['-e', 'POSTGRES_PASSWORD']);
  const redisPort = container('redis', 'redis:7-alpine', 6379);
  const options = { host: '127.0.0.1', port: pgPort, database: 'postgres', connectionTimeoutMillis: 1000, statement_timeout: 4000, query_timeout: 5000 };
  const admin = new Pool({ ...options, user: 'postgres', password, max: 2 }); pools.push(admin);
  step = 'ready'; let ready = false;
  for (let n = 0; n < 60; n++) { try { await admin.query('SELECT 1'); ready = true; break; } catch { await delay(250); } } assert.ok(ready);
  for (const file of ['000_roles.sql', '001_schema.sql', '002_constraints.sql', '003_rls.sql', '004_auth_context.sql', '005_password_recovery.sql', '008_recovery_steps.sql']) {
    step = `sql_${file}`; await admin.query(readFileSync(path.join(backend, 'prisma/sql', file), 'utf8'));
  }
  // SQL008 intentionally does not require companies/invitations SQL006/007.
  await admin.query(`ALTER ROLE wc_identity LOGIN PASSWORD '${runtimePassword}'`);
  const pool = new Pool({ ...options, user: 'wc_identity', password: runtimePassword, max: 3 }); pools.push(pool);
  const identity = new PrismaClient({ adapter: new PrismaPg(pool, { schema: 'app_private', onConnectionError: () => {}, onPoolError: () => {} }), log: [], errorFormat: 'minimal' }); clients.push(identity);
  redis = new Redis(`redis://127.0.0.1:${redisPort}`, { lazyConnect: true, connectTimeout: 3000, commandTimeout: 3000, maxRetriesPerRequest: 0, enableOfflineQueue: false }); redis.on('error', () => {}); await redis.connect();
  const limits = new RedisRateLimits({ eval: (script, key, args) => redis.eval(script, 1, key, ...args) }, randomBytes(32));
  const crypto = new RecoveryCrypto(randomBytes(32), randomBytes(32));
  const recovery = new RecoveryService(new PrismaRecoveryPort(identity), limits, crypto);
  const oldPassword = 'SyntheticOriginal!'; const newPassword = 'Abcdefg!'; const email = 'synthetic@example.test'; const uid = randomUUID(); const phc = await hashPassword(oldPassword);
  await admin.query('INSERT INTO app_private.app_user(id,email_normalized,password_hash) VALUES($1,$2,$3)', [uid, email, phc]);
  const identityPort = new PrismaIdentityPort(identity, new CompanyCursor(randomBytes(32)));
  const auth = new AuthService(identityPort, limits, new AccessTokens(randomBytes(32)), phc);
  const module = await Test.createTestingModule({ imports: [AuthModule] }).overrideProvider(AuthRuntime).useValue({ ready: async () => ({ service: auth, identity: identityPort, recovery }) }).compile();
  app = module.createNestApplication({ logger: false, bodyParser: false }); app.setGlobalPrefix('api'); app.use(authJsonMiddleware(true)); await app.listen(0, '127.0.0.1');
  const api = await app.getUrl(); process.env.EXPO_PUBLIC_API_URL = api;
  hooks = registerHooks({
    resolve(specifier, context, next) { if (context.parentURL?.startsWith(mobileSource) && /^\.\.?\//.test(specifier) && !path.extname(specifier)) return next(new URL(`${specifier}.ts`, context.parentURL).href, context); return next(specifier, context); },
    load(url, context, next) { if (url.startsWith(mobileSource) && url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText }; return next(url, context); },
  });
  const { PasswordRecovery } = await import(new URL('../src/auth/recovery.ts', import.meta.url));
  const { Session } = await import(new URL('../src/auth/session.ts', import.meta.url));
  const { request } = await import(new URL('../src/api/client.ts', import.meta.url));
  let saved = null; const session = new Session({ read: async () => saved, write: async value => { saved = value; }, clear: async () => { saved = null; } });
  await session.login(email, oldPassword); check(session.getSnapshot().user?.id === uid, 'original_login');
  let grant; let completes = 0;
  const flow = new PasswordRecovery(async (url, options) => { if (url.endsWith('/complete')) completes++; const value = await request(url, options); if (url.endsWith('/verify')) grant = value; return value; });
  step = 'request'; await flow.request(email); check(flow.getSnapshot().stage === 'verify', 'request202');
  // Synthetic fixture only: inspect its encrypted outbox instead of sending external mail.
  const row = (await admin.query('SELECT * FROM app_private.password_recovery WHERE user_id=$1 AND invalidated_at IS NULL AND consumed_at IS NULL', [uid])).rows[0];
  const opened = crypto.open(row.id, { payload: row.encrypted_payload.toString('hex'), nonce: row.nonce.toString('hex'), tag: row.auth_tag.toString('hex') });
  check(/^[0-9]{8}$/.test(opened.code), 'eight_digits');
  await flow.verify(opened.code === '99999999' ? '00000000' : '99999999');
  check(flow.getSnapshot().stage === 'verify', 'wrong_code_no_password');
  check((await admin.query('SELECT verification_attempts FROM app_private.password_recovery WHERE id=$1', [row.id])).rows[0].verification_attempts === 1, 'wrong_attempt_committed');
  await flow.verify(opened.code); check(flow.getSnapshot().stage === 'reset', 'verified200');
  check(grant?.expiresAt === row.expires_at.toISOString(), 'same_original_expiry');
  const verified = (await admin.query('SELECT reset_token_hash,encrypted_payload,state FROM app_private.password_recovery WHERE id=$1', [row.id])).rows[0];
  check(verified.reset_token_hash.toString('hex') === crypto.resetHash(grant.resetToken), 'only_grant_hash_stored');
  check(verified.encrypted_payload === null && verified.state === 'CANCELLED', 'verified_code_delivery_cancelled');
  await flow.reset('Abcdef!', 'Abcdef!'); check(completes === 0, 'seven_char_rejected_locally');
  await flow.reset(newPassword, newPassword); check(flow.getSnapshot().stage === 'done' && completes === 1, 'complete204_eight_chars');
  check(!JSON.stringify(flow.getSnapshot()).includes(grant.resetToken) && !JSON.stringify(flow.getSnapshot()).includes(newPassword) && !JSON.stringify(flow.getSnapshot()).includes(opened.code), 'snapshot_no_secrets');
  check((await admin.query('SELECT count(*)::int n FROM app_private.app_session WHERE user_id=$1 AND revoked_at IS NULL', [uid])).rows[0].n === 0, 'all_sessions_revoked_no_auto_login');
  check(await verifyPassword((await admin.query('SELECT password_hash FROM app_private.app_user WHERE id=$1', [uid])).rows[0].password_hash, newPassword), 'real_argon2_eight_chars');
  let denied = false; try { await session.get('/auth/me'); } catch { denied = true; } check(denied && session.getSnapshot().user === null, 'old_session_rejected');
  const post = (route, body) => fetch(`${api}/api/auth/password-recovery/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const replay = await post('complete', { email, resetToken: grant.resetToken, password: newPassword }); check(replay.status === 400, 'grant_single_use');
  const oldCode = await post('reset', { email, code: opened.code, password: newPassword }); check(oldCode.status === 400, 'no_legacy_code_bypass');
  const unknown = await post('complete', { email: 'absent@example.test', resetToken: grant.resetToken, password: newPassword });
  check(unknown.status === 400 && JSON.stringify(await unknown.json()) === JSON.stringify(await replay.json()), 'invalid_grant_unknown_email_generic');
  const resend = await post('request', { email }); check(resend.status === 429 && Number(resend.headers.get('retry-after')) > 0, 'redis_resend_limit');
  const absent = await post('request', { email: 'absent@example.test' }); check(absent.status === 202 && (await absent.json()).message === recoveryMessage, 'unknown_request_generic202');
  check((await admin.query('SELECT count(*)::int n FROM app_private.password_recovery')).rows[0].n === 1, 'unknown_request_no_outbox');
  await session.login(email, newPassword); check(session.getSnapshot().user?.id === uid, 'login_new_password');
  await session.logout(); check(saved === null, 'logout_clears_simulated_secure_storage');
  console.log(`RECOVERY_STEPS_ISOLATED_OK checks=${checks}; mobile TS/Nest/PG17/Redis7; no DEV, email or native UI.`);
} catch { console.error(`RECOVERY_STEPS_ISOLATED_FAILED step=${step}; sanitized.`); process.exitCode = 1; }
finally {
  const closed = await Promise.allSettled([app?.close(), ...clients.map(client => client.$disconnect())]);
  if (closed.some(result => result.status === 'rejected')) { console.error('RECOVERY_STEPS_CLOSE_FAILED'); process.exitCode = 1; }
  hooks?.deregister(); redis?.disconnect(); await Promise.allSettled(pools.map(pool => pool.end()));
  for (const name of started.reverse()) try { docker(['stop', '--time', '2', name]); } catch { console.error('RECOVERY_STEPS_CONTAINER_CLOSE_FAILED'); process.exitCode = 1; }
}
