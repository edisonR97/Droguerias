// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('cliente API del escritorio', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('guarda la sesion despues de iniciar sesion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          user: { id: 'u1', email: 'owner@farmacore.local' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { login } = await import('./api');

    await login('owner@farmacore.local', 'secure-password');

    expect(sessionStorage.getItem('farmacore.accessToken')).toBe('access-1');
    expect(sessionStorage.getItem('farmacore.refreshToken')).toBe('refresh-1');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('renueva el token y repite una solicitud rechazada con 401', async () => {
    sessionStorage.setItem('farmacore.accessToken', 'expired-access');
    sessionStorage.setItem('farmacore.refreshToken', 'refresh-1');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'access-2', refreshToken: 'refresh-2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'u1', email: 'owner@farmacore.local' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { getDashboard } = await import('./api');

    await expect(getDashboard()).resolves.toMatchObject({ id: 'u1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sessionStorage.getItem('farmacore.accessToken')).toBe('access-2');
  });

  it('propaga el mensaje de error entregado por la API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Acceso denegado' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const { getDashboard } = await import('./api');

    await expect(getDashboard()).rejects.toThrow('Acceso denegado');
  });

  it('elimina credenciales al cerrar sesion', async () => {
    sessionStorage.setItem('farmacore.accessToken', 'access-1');
    sessionStorage.setItem('farmacore.refreshToken', 'refresh-1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const { logout } = await import('./api');

    await logout();

    expect(sessionStorage.getItem('farmacore.accessToken')).toBeNull();
    expect(sessionStorage.getItem('farmacore.refreshToken')).toBeNull();
  });
});
