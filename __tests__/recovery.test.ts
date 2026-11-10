import { PasswordRecovery, recoveryMessage } from '../src/auth/recovery';
import { ApiError, type Transport } from '../src/api/client';
function fixture(){const transport=jest.fn<ReturnType<Transport>,Parameters<Transport>>().mockResolvedValue({message:recoveryMessage});return{transport,flow:new PasswordRecovery(transport)};}
it('request genérico y reset no guardan secretos en snapshot ni inician sesión',async()=>{
  const {flow,transport}=fixture();await flow.request(' synthetic@example.test ');
  expect(flow.getSnapshot().stage).toBe('reset');
  transport.mockResolvedValue(undefined);await flow.reset('synthetic@example.test','00001234','SyntheticNewPassword!','SyntheticNewPassword!');
  expect(flow.getSnapshot().stage).toBe('done');
  expect(transport).toHaveBeenLastCalledWith('/auth/password-recovery/reset',expect.objectContaining({body:{email:'synthetic@example.test',code:'00001234',password:'SyntheticNewPassword!'}}));
  expect(JSON.stringify(flow.getSnapshot())).not.toMatch(/00001234|SyntheticNewPassword!|synthetic@example/);
});
it('política, confirmación y ocho dígitos antes de enviar',async()=>{
  const {flow,transport}=fixture();await flow.request('synthetic@example.test');transport.mockClear();
  await flow.reset('synthetic@example.test','123','SyntheticNewPassword!','SyntheticNewPassword!');
  await flow.reset('synthetic@example.test','00001234','short!','short!');
  await flow.reset('synthetic@example.test','00001234','SyntheticNewPassword!','Mismatch!');
  expect(transport).not.toHaveBeenCalled();expect(flow.getSnapshot().stage).toBe('reset');
});
it('no reintenta error código ni error de red',async()=>{
  const {flow,transport}=fixture();await flow.request('synthetic@example.test');transport.mockClear();transport.mockRejectedValue(new ApiError(400,'INVALID_RECOVERY_CODE'));
  await flow.reset('synthetic@example.test','00001234','SyntheticNewPassword!','SyntheticNewPassword!');
  expect(transport).toHaveBeenCalledTimes(1);expect(flow.getSnapshot().message).toContain('Código inválido');
});
it('ignora respuesta tardía después de cancelar incluso si transporte ignora abort',async()=>{
  const {flow,transport}=fixture();let complete!:(value:unknown)=>void;
  transport.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  const pending=flow.request('synthetic@example.test');flow.cancel();complete({message:recoveryMessage});await pending;
  expect(flow.getSnapshot().stage).toBe('request');expect(flow.getSnapshot().busy).toBe(false);
});
it('bloquea pulsaciones duplicadas y rechaza respuesta incompatible',async()=>{
  const {flow,transport}=fixture();let complete!:(value:unknown)=>void;
  transport.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  const pending=flow.request('synthetic@example.test');await flow.request('synthetic@example.test');expect(transport).toHaveBeenCalledTimes(1);
  complete({message:'Entrega garantizada'});await pending;expect(flow.getSnapshot().stage).toBe('request');
});
