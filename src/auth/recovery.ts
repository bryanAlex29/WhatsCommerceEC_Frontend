import { ApiError, request, type Transport } from '../api/client';
import { newPasswordValid, passwordPolicyMessage } from './password-policy';

export const recoveryMessage = 'Si el correo está registrado, recibirás un código de recuperación.';
export type RecoveryState = { stage: 'request' | 'verify' | 'reset' | 'done' | 'uncertain'; busy: boolean; message: string; retryAt: number; canVerify: boolean };
/** Private email/grant never appear in snapshots, navigation, storage, URLs or logs. */
export class PasswordRecovery {
  private state: RecoveryState = { stage: 'request', busy: false, message: '', retryAt: 0, canVerify: false };
  private email = ''; private grant: string | null = null;
  private generation = 0; private controller?: AbortController;
  private listeners = new Set<() => void>();
  constructor(private readonly transport: Transport = request) {}
  getSnapshot = (): RecoveryState => this.state;
  getEmail = (): string => this.email;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<RecoveryState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  cancel() {
    this.generation++; this.controller?.abort(); this.controller = undefined; this.grant = null; this.email = '';
    this.update({ stage: 'request', busy: false, canVerify: false, message: 'Recuperación interrumpida. Si ya enviaste el cambio, vuelve al login para comprobar el acceso.' });
  }
  dispose() { this.generation++; this.controller?.abort(); this.grant = null; this.email = ''; this.listeners.clear(); }
  returnToRequest() {
    if (this.state.stage === 'request') return;
    this.generation++; this.controller?.abort(); this.grant = null;
    this.update({ stage: 'request', busy: false, canVerify: false, message: '' });
  }
  async request(email: string): Promise<void> {
    if (this.state.busy || this.state.stage === 'done' || this.state.stage === 'uncertain') return;
    if (!email.trim() || email.length > 1024) { this.update({ message: 'Introduce tu correo registrado.' }); return; }
    if (Date.now() < this.state.retryAt) { this.update({ message: 'Espera antes de solicitar otro código.' }); return; }
    this.grant = null; this.email = email.trim();
    this.update({ retryAt: Date.now() + 60000, canVerify: false, stage: this.state.stage === 'request' ? 'request' : 'verify' });
    await this.run('request', { email: this.email });
  }
  async verify(code: string): Promise<void> {
    if (this.state.busy || this.state.stage !== 'verify' || !this.state.canVerify) return;
    if (!/^[0-9]{8}$/.test(code)) { this.update({ message: 'Introduce el código de ocho dígitos, incluidos los ceros iniciales.' }); return; }
    await this.run('verify', { email: this.email, code });
  }
  async reset(password: string, confirmation: string): Promise<void> {
    if (this.state.busy || this.state.stage !== 'reset' || !this.grant) return;
    if (!newPasswordValid(password)) { this.update({ message: passwordPolicyMessage }); return; }
    if (password !== confirmation) { this.update({ message: 'Las contraseñas no coinciden.' }); return; }
    await this.run('complete', { email: this.email, resetToken: this.grant, password });
  }
  private async run(operation: 'request' | 'verify' | 'complete', body: unknown) {
    const generation = ++this.generation; const controller = new AbortController(); this.controller = controller;
    this.update({ busy: true, message: '' });
    try {
      const response = await this.transport(`/auth/password-recovery/${operation}`, { method: 'POST', body, signal: controller.signal });
      if (generation !== this.generation) return;
      if (operation === 'request') {
        if (!response || typeof response !== 'object' || Object.keys(response).length !== 1 || (response as { message?: unknown }).message !== recoveryMessage) throw new Error();
        this.update({ stage: 'verify', canVerify: true, message: recoveryMessage });
      } else if (operation === 'verify') {
        if (!response || typeof response !== 'object' || Object.keys(response).sort().join() !== 'expiresAt,resetToken') throw new Error();
        const value = response as Record<string, unknown>;
        if (typeof value.resetToken !== 'string' || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value.resetToken) ||
          typeof value.expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.expiresAt) ||
          !Number.isFinite(Date.parse(value.expiresAt)) || new Date(value.expiresAt).toISOString() !== value.expiresAt) throw new Error();
        this.grant = value.resetToken;
        this.update({ stage: 'reset', canVerify: false, message: '' });
      } else {
        if (response !== undefined) throw new Error();
        this.grant = null; this.email = '';
        this.update({ stage: 'done', message: 'Contraseña actualizada. Las sesiones anteriores se cerraron. Vuelve a iniciar sesión.' });
      }
    } catch (error) {
      if (generation !== this.generation) return;
      const known = error instanceof ApiError;
      if (known && error.retryAfter) this.update({ retryAt: Math.max(this.state.retryAt, Date.now() + error.retryAfter * 1000) });
      if (operation === 'complete' && !(known && ['VALIDATION_ERROR', 'RATE_LIMITED'].includes(error.code))) {
        this.grant = null;
        this.update({ stage: known && error.code === 'INVALID_RECOVERY_CODE' ? 'verify' : 'uncertain', canVerify: false,
          message: known && error.code === 'INVALID_RECOVERY_CODE' ? 'La recuperación ya no está disponible. Solicita otro código.' : 'No se pudo confirmar el cambio. No se repetirá automáticamente. Vuelve al login para comprobar el acceso.' });
      } else if (operation === 'verify' && (!known || error.status >= 500 || error.status === 404)) {
        this.grant = null; this.update({ canVerify: false, message: 'No se pudo confirmar la verificación. Solicita otro código; no se repetirá automáticamente.' });
      } else this.update({ message: known ? error.message : 'No se pudo confirmar el envío. Espera y solicita otro código si lo necesitas.' });
    } finally { if (generation === this.generation) { this.controller = undefined; this.update({ busy: false }); } }
  }
}
