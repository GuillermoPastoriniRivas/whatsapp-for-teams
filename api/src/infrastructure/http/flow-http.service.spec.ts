import { FlowHttpService } from './flow-http.service.js';

// El nodo HTTP llama URLs que escribe el tenant: si el guard SSRF cede, un
// flujo puede leer la metadata de la nube (169.254.169.254) o servicios
// internos. La validación vive en el `lookup` del socket, así que estos tests
// ejercitan el camino real de conexión.
describe('FlowHttpService — guard SSRF', () => {
  const service = new FlowHttpService();

  const call = (url: string) =>
    service.request({ method: 'GET', url, headers: {}, timeoutMs: 2000 });

  it.each([
    ['loopback', 'http://127.0.0.1/'],
    ['metadata de la nube', 'http://169.254.169.254/latest/meta-data/'],
    ['RFC1918 (10.x)', 'http://10.0.0.5/'],
    ['RFC1918 (192.168.x)', 'http://192.168.1.1/'],
    ['RFC1918 (172.16.x)', 'http://172.16.0.1/'],
    ['IPv6 loopback', 'http://[::1]/'],
  ])('rechaza %s', async (_label, url) => {
    await expect(call(url)).rejects.toThrow(/red privada/i);
  });

  it('rechaza protocolos que no sean http(s)', async () => {
    await expect(call('file:///etc/passwd')).rejects.toThrow(/http/i);
  });
});
