import { ApiError, NetworkError, request, type Transport } from '../api/client';
import { company, companyPage, ContractError, refreshToken, sessionTokens, userSelf, uuid, type Company, type CompanySelection, type SessionTokens, type UserSelf } from '../api/contracts';
import type { SecureStorage } from './secureStorage';

export type SessionState = {
  user: UserSelf | null; company: Company | null; companies: CompanySelection[];
  nextCursor: string | null; listLoaded: boolean; busy: boolean; message: string;
};
const empty = (): SessionState => ({ user: null, company: null, companies: [], nextCursor: null, listLoaded: false, busy: false, message: '' });
function message(error: unknown): string { return error instanceof ApiError || error instanceof NetworkError || error instanceof ContractError ? error.message : 'No se pudo completar la operación de forma segura.'; }
class StaleResponse extends Error {}

/** Único propietario de credenciales y datos privados; ningún token forma parte del snapshot UI. */
export class Session {
  private state = empty();
  private listeners = new Set<() => void>();
  private generation = 0;
  private contextGeneration = 0;
  private listGeneration = 0;
  private access: string | null = null;
  private refresh: string | null = null;
  private absoluteExpiry: string | null = null;
  private refreshFlight: Promise<void> | null = null;
  private storageQueue: Promise<unknown> = Promise.resolve();
  private controllers = new Set<AbortController>();
  private companyControllers = new Set<AbortController>();
  private listPending = false;
  private selectedId: string | null = null;
  private storageBlocked = false;
  private authPending = false;
  constructor(private storage: SecureStorage, private transport: Transport = request) {}
  getSnapshot = (): SessionState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(patch: Partial<SessionState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.storageQueue.then(task, task);
    this.storageQueue = next.catch(() => undefined);
    return next;
  }
  private check(generation: number) { if (generation !== this.generation) throw new StaleResponse(); }
  private async call(path: string, options: Parameters<Transport>[1] = {}, companyRequest = false): Promise<unknown> {
    const controller = new AbortController();
    this.controllers.add(controller);
    if (companyRequest) this.companyControllers.add(controller);
    try { return await this.transport(path, { ...options, signal: controller.signal }); }
    finally { this.controllers.delete(controller); this.companyControllers.delete(controller); }
  }
  private abortCompanyRequests() { this.companyControllers.forEach(controller => controller.abort()); this.companyControllers.clear(); }
  private invalidate() {
    this.generation++; this.contextGeneration++; this.listGeneration++;
    this.controllers.forEach(controller => controller.abort()); this.controllers.clear();
    this.companyControllers.clear();
    this.access = null; this.refresh = null; this.absoluteExpiry = null;
    this.selectedId = null; this.refreshFlight = null; this.listPending = false;
    this.authPending = false;
    this.state = empty(); this.update({});
  }
  private async revoke(token: string): Promise<boolean> {
    try { await this.transport('/auth/logout', { method: 'POST', body: { refreshToken: token } }); return true; } catch { return false; }
  }
  private async publish(tokens: SessionTokens, generation: number) {
    // Las respuestas tardías se revocan incluso si el transporte ignoró AbortSignal.
    if (generation !== this.generation) { await this.revoke(tokens.refreshToken); throw new StaleResponse(); }
    // El reloj del dispositivo no autoriza ni vence sesiones. El servidor valida el
    // plazo; aquí solo impedimos cambiar el vencimiento absoluto ya recibido.
    if ((this.absoluteExpiry && tokens.refreshExpiresAt !== this.absoluteExpiry) || (this.state.user && tokens.user.id !== this.state.user.id)) {
      await this.revoke(tokens.refreshToken); throw new ContractError();
    }
    try {
      await this.serialized(async () => { this.check(generation); await this.storage.write(tokens.refreshToken); this.check(generation); });
    } catch (error) { await this.revoke(tokens.refreshToken); throw error; }
    this.check(generation);
    this.refresh = tokens.refreshToken; this.access = tokens.accessToken; this.absoluteExpiry = tokens.refreshExpiresAt;
    this.update({ user: tokens.user });
  }
  async login(email: string, password: string): Promise<void> {
    if (this.authPending || this.state.busy || this.state.user) return;
    if (this.storageBlocked) { this.update({ message: 'Vuelve a cerrar sesión para borrar el almacenamiento seguro antes de ingresar.' }); return; }
    const generation = this.generation;
    this.authPending = true;
    this.update({ busy: true, message: '' });
    try {
      // Backend es autoridad de IDNA y contraseña; no transformar contraseña.
      if (!email.trim() || email.length > 1024 || !password || [...password].length > 128) throw new Error();
      const tokens = sessionTokens(await this.call('/auth/login', { method: 'POST', body: { email: email.trim(), password } }));
      await this.publish(tokens, generation);
      await this.loadCompanies();
    } catch (error) {
      if (generation === this.generation) {
        if (this.state.user) this.update({ message: message(error) });
        else { await this.failSession(message(error), generation); }
      }
    } finally { if (generation === this.generation) { this.authPending = false; this.update({ busy: false }); } }
  }
  /** No lectura/renovación automática al montar: solo acción explícita del usuario. */
  async restore(): Promise<void> {
    if (this.authPending || this.state.busy || this.state.user) return;
    if (this.storageBlocked) { this.update({ message: 'Vuelve a cerrar sesión para borrar el almacenamiento seguro antes de restaurar.' }); return; }
    const generation = this.generation;
    this.authPending = true;
    this.update({ busy: true, message: '' });
    try {
      const saved = await this.serialized(() => this.storage.read()); this.check(generation);
      if (!saved) { this.update({ message: 'No hay una sesión guardada. Inicia sesión.' }); return; }
      this.refresh = refreshToken(saved);
      await this.renew(); this.check(generation);
      const self = userSelf(await this.get('/auth/me')); this.check(generation);
      if (self.id !== this.getSnapshot().user?.id) throw new ContractError();
      this.update({ user: self }); await this.loadCompanies();
    } catch (error) { if (generation === this.generation) await this.failSession(message(error), generation); }
    finally { if (generation === this.generation) { this.authPending = false; this.update({ busy: false }); } }
  }
  private async failSession(reason: string, generation: number) {
    if (generation !== this.generation) return;
    await this.logout(reason.includes('Inicia sesión') ? reason : `${reason} Inicia sesión nuevamente.`);
  }
  private renew(): Promise<void> {
    if (this.refreshFlight) return this.refreshFlight;
    const generation = this.generation;
    const token = this.refresh;
    const flight = (async () => {
      try {
        if (!token) throw new ApiError(401, 'UNAUTHENTICATED');
        const tokens = sessionTokens(await this.call('/auth/refresh', { method: 'POST', body: { refreshToken: token } }));
        await this.publish(tokens, generation);
      } catch (error) {
        if (generation === this.generation) await this.failSession('No se pudo confirmar la renovación.', generation);
        throw error;
      }
    })();
    this.refreshFlight = flight;
    void flight.finally(() => { if (this.refreshFlight === flight) this.refreshFlight = null; }).catch(() => undefined);
    return flight;
  }
  /** Solo GET protegido; no existe replay automático de escrituras. */
  async get(path: string, context?: number): Promise<unknown> {
    const generation = this.generation;
    const check = () => { this.check(generation); if (context !== undefined && context !== this.contextGeneration) throw new StaleResponse(); };
    const access = this.access;
    if (!access) throw new ApiError(401, 'UNAUTHENTICATED');
    try { const result = await this.call(path, { access }, context !== undefined); check(); return result; }
    catch (error) {
      check();
      if (error instanceof ApiError && error.status === 401 && error.code === 'ACCESS_TOKEN_EXPIRED') {
        if (this.access === access) await this.renew();
        check();
        try { const result = await this.call(path, { access: this.access! }, context !== undefined); check(); return result; }
        catch (retryError) { check(); await this.handleProtectedError(retryError, generation); throw retryError; }
      }
      await this.handleProtectedError(error, generation); throw error;
    }
  }
  private async handleProtectedError(error: unknown, generation: number) {
    if (!(error instanceof ApiError)) return;
    if (error.status === 401) await this.failSession(error.message, generation);
    else if (error.status === 403 && ['COMPANY_SUSPENDED', 'COMPANY_PENDING_ACTIVATION'].includes(error.code)) { this.backToCompanies(); this.update({ busy: false, message: error.message }); }
  }
  async logout(reason = 'Sesión local cerrada.'): Promise<void> {
    const token = this.refresh;
    this.invalidate();
    const generation = this.generation;
    this.update({ busy: true, message: reason });
    let saved: string | null = null; let cleared = true;
    await this.serialized(async () => {
      try { saved = await this.storage.read(); } catch { /* Intentar borrar aun si falla lectura. */ }
      try { await this.storage.clear(); } catch { cleared = false; }
      this.storageBlocked = !cleared;
    });
    const tokens = [...new Set([token, saved].filter((value): value is string => Boolean(value)))];
    const revoked = await Promise.all(tokens.map(value => this.revoke(value)));
    if (generation === this.generation) this.update({ busy: false, message: `${reason}${!cleared ? ' No se pudo borrar el almacenamiento seguro; vuelve a intentar cerrar sesión antes de restaurar.' : ''}${revoked.some(ok => !ok) ? ' No se confirmó la revocación remota.' : ''}` });
  }
  async loadCompanies(more = false): Promise<void> {
    if (this.listPending || !this.state.user || (more && !this.state.nextCursor)) return;
    this.listPending = true;
    const generation = this.generation; const listGeneration = this.listGeneration;
    const current = () => generation === this.generation && listGeneration === this.listGeneration;
    let cursor = more ? this.state.nextCursor : null; let restarted = false;
    if (!more) this.update({ companies: [], nextCursor: null, listLoaded: false });
    this.update({ busy: true, message: '' });
    try {
      while (true) {
        try {
          const page = companyPage(await this.get(`/me/companies${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`));
          if (!current()) return;
          if (cursor && page.nextCursor === cursor) throw new ContractError();
          const previous = cursor ? this.state.companies : [];
          if (page.items.some(item => previous.some(old => old.companyId === item.companyId))) throw new ContractError();
          this.update({ companies: [...previous, ...page.items], nextCursor: page.nextCursor, listLoaded: true }); return;
        } catch (error) {
          if (!current()) return;
          if (error instanceof ApiError && error.status === 400 && error.code === 'INVALID_CURSOR' && !restarted) {
            restarted = true; cursor = null; this.update({ companies: [], nextCursor: null, listLoaded: false }); continue;
          }
          throw error;
        }
      }
    } catch (error) {
      if (current()) this.update({ message: message(error), ...(error instanceof ContractError || (error instanceof ApiError && [400, 403, 404].includes(error.status)) ? { companies: [], nextCursor: null, listLoaded: false } : {}) });
    }
    finally { if (current()) { this.listPending = false; this.update({ busy: false }); } }
  }
  backToCompanies() {
    this.contextGeneration++; this.selectedId = null;
    this.abortCompanyRequests();
    this.update({ company: null, busy: false });
  }
  async selectCompany(id: string): Promise<void> {
    if (!this.state.user) return;
    const generation = this.generation; const context = ++this.contextGeneration;
    this.abortCompanyRequests();
    this.selectedId = id;
    this.update({ company: null, busy: true, message: '' });
    try {
      uuid(id);
      const result = company(await this.get(`/companies/${encodeURIComponent(id)}`, context));
      if (generation !== this.generation || context !== this.contextGeneration) return;
      if (result.id !== id || result.status !== 'ACTIVE') throw new ContractError();
      this.update({ company: result }); // Reemplazo completo, nunca merge FULL/BASIC.
    } catch (error) {
      if (generation === this.generation && context === this.contextGeneration) { this.selectedId = null; this.update({ company: null, message: message(error) }); }
    } finally { if (generation === this.generation && context === this.contextGeneration) this.update({ busy: false }); }
  }
  suspendContext() { this.contextGeneration++; this.abortCompanyRequests(); this.update({ company: null, busy: false }); }
  async focus() { if (this.selectedId) await this.selectCompany(this.selectedId); else if (this.state.user) await this.loadCompanies(); }
}
