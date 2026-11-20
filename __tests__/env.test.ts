import { parseApiUrl } from '../src/config/env';

describe('Configuración pública', () => {
  it.each([undefined, '', 'ftp://host', 'http://user:secret@host', 'http://host/api', 'http://host?token=x', 'http://host#x'])('rechaza URL inválida %s', (value) => {
    expect(() => parseApiUrl(value)).toThrow();
  });
  it.each(['http://10.0.2.2:3000', 'http://localhost:3000', 'https://example.test'])('acepta una base HTTP(S): %s', (url) => {
    expect(parseApiUrl(`${url}/`)).toBe(url);
  });
});
