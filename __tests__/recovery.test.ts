import { PasswordRecovery, recoveryMessage } from '../src/auth/recovery';
import { ApiError, NetworkError, type Transport } from '../src/api/client';
import { newPasswordValid } from '../src/auth/password-policy';
const email = 'synthetic@example.test'; const token = 'A'.repeat(43);
const grant = { resetToken: token, expiresAt: '2027-01-01T00:00:00.000Z' };
function fixture() { const transport = jest.fn<ReturnType<Transport>, Parameters<Transport>>().mockResolvedValue({ message: recoveryMessage }); return { transport, flow: new PasswordRecovery(transport) }; }
async function ready() { const f = fixture(); await f.flow.request(email); f.transport.mockResolvedValue(grant); await f.flow.verify('00001234'); return f; }
it('tres pasos reales sin secretos en snapshot ni login automático', async () => {
  const { flow, transport } = fixture(); await flow.request(` ${email} `);
  expect(flow.getSnapshot().stage).toBe('verify');
  transport.mockResolvedValue(grant); await flow.verify('00001234'); expect(flow.getSnapshot().stage).toBe('reset');
  expect(transport).toHaveBeenLastCalledWith('/auth/password-recovery/verify', expect.objectContaining({ body: { email, code: '00001234' } }));
  transport.mockResolvedValue(undefined); await flow.reset('Abcdefg!', 'Abcdefg!'); expect(flow.getSnapshot().stage).toBe('done');
  expect(transport).toHaveBeenLastCalledWith('/auth/password-recovery/complete', expect.objectContaining({ body: { email, resetToken: token, password: 'Abcdefg!' } }));
  expect(JSON.stringify(flow.getSnapshot())).not.toMatch(/00001234|Abcdefg!|synthetic@example|AAAAAAAAAA/);
  expect(flow.getEmail()).toBe(''); expect(transport).toHaveBeenCalledTimes(3);
});
it('no abre nueva contraseña con formato inválido o código rechazado', async () => {
  const { flow, transport } = fixture(); await flow.request(email); transport.mockClear();
  await flow.verify('123'); expect(transport).not.toHaveBeenCalled();
  transport.mockRejectedValue(new ApiError(400, 'INVALID_RECOVERY_CODE')); await flow.verify('99999999');
  expect(flow.getSnapshot().stage).toBe('verify'); expect(flow.getSnapshot().message).toContain('Código inválido');
});
it('mínimo8, confirmación y resto de reglas se comprueban antes de complete', async () => {
  const { flow, transport } = await ready(); transport.mockClear();
  await flow.reset('Abcdef!', 'Abcdef!'); await flow.reset('Abcdefg!', 'Different!');
  expect(transport).not.toHaveBeenCalled(); expect(flow.getSnapshot().stage).toBe('reset');
  expect(newPasswordValid('Abcdef!')).toBe(false); expect(newPasswordValid('Abcdefg!')).toBe(true);
  for (const value of ['abcdefgh!', 'Abcdefgh', 'Abc def!', 'Abcdefg!\u200b']) expect(newPasswordValid(value)).toBe(false);
});
it('cambio incierto no ofrece otro envío ni conserva el pase', async () => {
  const { flow, transport } = await ready(); transport.mockRejectedValue(new NetworkError());
  await flow.reset('Abcdefg!', 'Abcdefg!'); expect(flow.getSnapshot().stage).toBe('uncertain');
  transport.mockClear(); await flow.reset('Abcdefg!', 'Abcdefg!'); expect(transport).not.toHaveBeenCalled();
});
it('cancelación descarta verificación tardía aunque transporte ignore abort', async () => {
  const { flow, transport } = fixture(); await flow.request(email); let complete!: (value: unknown) => void;
  transport.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const pending = flow.verify('00001234'); flow.cancel(); complete(grant); await pending;
  expect(flow.getSnapshot().stage).toBe('request'); expect(flow.getEmail()).toBe('');
  transport.mockClear(); await flow.reset('Abcdefg!', 'Abcdefg!'); expect(transport).not.toHaveBeenCalled();
});
it('pulsaciones duplicadas se bloquean y no se acepta respuesta verify corrupta', async () => {
  const { flow, transport } = fixture(); await flow.request(email); transport.mockClear(); let complete!: (value: unknown) => void;
  transport.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const pending = flow.verify('00001234'); await flow.verify('00001234'); expect(transport).toHaveBeenCalledTimes(1);
  complete({ ...grant, extra: 'not-allowed' }); await pending;
  expect(flow.getSnapshot().stage).toBe('verify'); expect(flow.getSnapshot().canVerify).toBe(false);
});
it('reenvío respeta60s e invalida pase anterior; un429 respetaRetry-After', async () => {
  jest.useFakeTimers(); try {
    const { flow, transport } = await ready(); transport.mockClear(); await flow.request(email); expect(transport).not.toHaveBeenCalled();
    jest.advanceTimersByTime(60001); transport.mockResolvedValue({ message: recoveryMessage }); await flow.request(email);
    expect(flow.getSnapshot().stage).toBe('verify'); transport.mockClear(); await flow.reset('Abcdefg!', 'Abcdefg!'); expect(transport).not.toHaveBeenCalled();
    jest.advanceTimersByTime(60001); transport.mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 180)); await flow.request(email);
    expect(flow.getSnapshot().retryAt).toBeGreaterThanOrEqual(Date.now() + 180000);
  } finally { jest.useRealTimers(); }
});
it('reenvío rechazado no conserva una continuación con un pase que pudo invalidarse', async () => {
  jest.useFakeTimers(); try {
    const { flow, transport } = await ready(); jest.advanceTimersByTime(60001);
    transport.mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 60)); await flow.request(email);
    expect(flow.getSnapshot().stage).toBe('verify'); expect(flow.getSnapshot().canVerify).toBe(false);
    transport.mockClear(); await flow.reset('Abcdefg!', 'Abcdefg!'); expect(transport).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
