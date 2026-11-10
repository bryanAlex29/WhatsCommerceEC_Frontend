import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { PasswordRecoveryScreen } from '../src/screens/PasswordRecoveryScreen';
import { recoveryMessage } from '../src/auth/recovery';

const fetchMock = jest.fn(); const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000'; globalThis.fetch = fetchMock;
  fetchMock.mockReset(); jest.spyOn(AppState,'addEventListener').mockReturnValue({remove:jest.fn()});
});
afterEach(() => { jest.restoreAllMocks(); globalThis.fetch=originalFetch; if(originalUrl===undefined) delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=originalUrl; });
async function requestCode() {
  fetchMock.mockResolvedValueOnce({ok:true,status:202,json:async()=>({message:recoveryMessage})});
  fireEvent.changeText(screen.getByLabelText('Correo registrado'),'synthetic@example.test');
  fireEvent.press(screen.getByRole('button',{name:'Solicitar código'}));
  await screen.findByLabelText('Código de ocho dígitos');
}
it('formulario accesible envía y borra secretos, sin login automático',async()=>{
  const back=jest.fn();render(<PasswordRecoveryScreen onBack={back}/>);await requestCode();
  expect(screen.getByLabelText('Nueva contraseña').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Confirmar nueva contraseña').props.secureTextEntry).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Código de ocho dígitos'),'00001234');
  fireEvent.changeText(screen.getByLabelText('Nueva contraseña'),'SyntheticNewPassword!');
  fireEvent.changeText(screen.getByLabelText('Confirmar nueva contraseña'),'SyntheticNewPassword!');
  fetchMock.mockResolvedValueOnce({ok:true,status:204});
  await act(async()=>{fireEvent.press(screen.getByRole('button',{name:'Cambiar contraseña'}));});
  expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
  expect(screen.getByRole('alert').props.children.join('')).toContain('Contraseña actualizada');
  fireEvent.press(screen.getByRole('button',{name:'Volver al login'}));expect(back).toHaveBeenCalledWith(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('segundo plano borra código y ambas claves',async()=>{
  let handler!:(state:'active'|'background')=>void;
  jest.spyOn(AppState,'addEventListener').mockImplementation((_event,listener)=>{handler=listener;return{remove:jest.fn()};});
  render(<PasswordRecoveryScreen onBack={()=>{}}/>);await requestCode();
  for(const label of ['Código de ocho dígitos','Nueva contraseña','Confirmar nueva contraseña'])fireEvent.changeText(screen.getByLabelText(label),'SyntheticSecret!');
  act(()=>handler('background'));
  for(const label of ['Código de ocho dígitos','Nueva contraseña','Confirmar nueva contraseña'])expect(screen.getByLabelText(label).props.value).toBe('');
});
it('volver no presenta éxito ni envía correo si no se solicitó',()=>{
  const back=jest.fn();render(<PasswordRecoveryScreen onBack={back}/>);
  fireEvent.press(screen.getByRole('button',{name:'Volver al login'}));expect(back).toHaveBeenCalledWith(false);expect(fetchMock).not.toHaveBeenCalled();
});
