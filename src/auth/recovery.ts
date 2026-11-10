import { ApiError, NetworkError, request, type Transport } from '../api/client';

export const recoveryMessage = 'Si el correo está registrado, recibirás un código de recuperación.';
export type RecoveryState = { stage: 'request' | 'reset' | 'done'; busy: boolean; message: string };
/** Sin persistencia de correo, código ni contraseñas; escrituras sin reintento. */
export class PasswordRecovery {
  private state: RecoveryState = { stage: 'request', busy: false, message: '' };
  private listeners = new Set<() => void>();
  private generation = 0;
  private controller?: AbortController;
  constructor(private readonly transport: Transport = request) {}
  getSnapshot = (): RecoveryState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<RecoveryState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  cancel() {
    this.generation++; this.controller?.abort(); this.controller = undefined;
    this.update({ busy: false, message: 'Operación interrumpida. Si ya enviaste el cambio, vuelve al login para comprobar el acceso.' });
  }
  dispose() {
    this.generation++; this.controller?.abort(); this.controller = undefined;
    this.listeners.clear();
  }
  async request(email: string): Promise<void> {
    if (this.state.busy || this.state.stage === 'done') return;
    if (!email.trim() || email.length > 1024) { this.update({ message: 'Introduce tu correo registrado.' }); return; }
    await this.run('/auth/password-recovery/request', { email: email.trim() }, 'reset');
  }
  async reset(email: string, code: string, password: string, confirmation: string): Promise<void> {
    if (this.state.busy || this.state.stage !== 'reset') return;
    if (!/^[0-9]{8}$/.test(code)) { this.update({ message: 'Introduce el código de ocho dígitos, incluidos los ceros iniciales.' }); return; }
    const length = [...password].length;
    if (length < 15 || length > 128 || !/\p{Lu}/u.test(password) || !/[\p{P}\p{S}]/u.test(password) || /[\p{White_Space}\p{Cc}\p{Cs}\p{Cf}]/u.test(password)) {
      this.update({ message: 'Usa 15–128 caracteres, una mayúscula y un símbolo, sin espacios ni caracteres invisibles. Los números son opcionales.' }); return;
    }
    if (password !== confirmation) { this.update({ message: 'Las contraseñas no coinciden.' }); return; }
    await this.run('/auth/password-recovery/reset', { email: email.trim(), code, password }, 'done');
  }
  private async run(path: string, body: unknown, stage: RecoveryState['stage']) {
    const generation = ++this.generation;
    const controller = new AbortController(); this.controller = controller;
    this.update({ busy: true, message: '' });
    try {
      const response = await this.transport(path, { method: 'POST', body, signal: controller.signal });
      if (generation !== this.generation) return;
      if (stage === 'reset') {
        if (!response || typeof response !== 'object' || (response as { message?: unknown }).message !== recoveryMessage || Object.keys(response).length !== 1) throw new Error();
        this.update({ stage, message: `${recoveryMessage} Revisa también spam. El código vence a los 15 minutos de solicitarlo.` });
      } else {
        if (response !== undefined) throw new Error();
        this.update({ stage, message: 'Contraseña actualizada. Las sesiones anteriores se cerraron. Vuelve a iniciar sesión.' });
      }
    } catch (error) {
      if (generation === this.generation) this.update({ message: error instanceof ApiError ? error.message : error instanceof NetworkError
        ? 'No se pudo confirmar el resultado. No se reintentará automáticamente. Si cambiaste la contraseña, prueba iniciar sesión.' : 'Respuesta no válida. No se pudo confirmar la operación.' });
    } finally { if (generation === this.generation) { this.controller = undefined; this.update({ busy: false }); } }
  }
}
