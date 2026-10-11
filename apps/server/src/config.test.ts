import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, parseAllowedOrigins, readServerConfig } from './config';
import { clientIp, isOriginAllowed } from './net';

describe('configuración por variables de entorno', () => {
  it('valores por defecto para desarrollo y red local', () => {
    expect(readServerConfig({})).toEqual({ port: DEFAULT_PORT, host: '0.0.0.0', allowedOrigins: null, trustProxyHops: 0 });
  });

  it('puerto asignado por la plataforma y demás variables', () => {
    expect(
      readServerConfig({
        PORT: '10000',
        HOST: '127.0.0.1',
        ALLOWED_ORIGINS: 'https://mind-racer.pages.dev',
        TRUST_PROXY_HOPS: '1',
      }),
    ).toEqual({ port: 10000, host: '127.0.0.1', allowedOrigins: ['https://mind-racer.pages.dev'], trustProxyHops: 1 });
  });

  it('ignora valores numéricos inválidos', () => {
    expect(readServerConfig({ PORT: 'abc', TRUST_PROXY_HOPS: '-3' })).toMatchObject({ port: DEFAULT_PORT, trustProxyHops: 0 });
  });

  it('lista de orígenes: separa por comas, recorta y quita la barra final', () => {
    expect(parseAllowedOrigins(' https://a.pages.dev/ , https://b.example ,')).toEqual(['https://a.pages.dev', 'https://b.example']);
    expect(parseAllowedOrigins('  ')).toBeNull();
    expect(parseAllowedOrigins(undefined)).toBeNull();
  });
});

describe('orígenes permitidos', () => {
  const allowed = ['https://mind-racer.pages.dev'];
  it('acepta el sitio publicado y rechaza otros o la ausencia de Origin', () => {
    expect(isOriginAllowed('https://mind-racer.pages.dev', allowed)).toBe(true);
    expect(isOriginAllowed('https://otro-sitio.example', allowed)).toBe(false);
    expect(isOriginAllowed(undefined, allowed)).toBe(false);
  });
  it('sin lista acepta todo', () => {
    expect(isOriginAllowed('http://192.168.1.12:5173', null)).toBe(true);
    expect(isOriginAllowed(undefined, null)).toBe(true);
  });
});

describe('IP del cliente', () => {
  it('sin proxies de confianza usa la IP de la conexión', () => {
    expect(clientIp('1.2.3.4', '10.0.0.5', 0)).toBe('10.0.0.5');
    expect(clientIp(undefined, '::ffff:10.0.0.5', 0)).toBe('10.0.0.5');
  });

  it('encabezado falsificado: con un proxy cuenta la IP que agregó el proxy', () => {
    // El cliente envió "1.2.3.4"; el proxy de la plataforma agregó la IP real al final.
    expect(clientIp('1.2.3.4, 200.1.1.1', '10.0.0.9', 1)).toBe('200.1.1.1');
  });

  it('con dos proxies cuenta dos desde la derecha', () => {
    expect(clientIp('9.9.9.9, 200.1.1.1, 10.1.1.1', '10.0.0.9', 2)).toBe('200.1.1.1');
  });

  it('si faltan entradas usa la IP de la conexión', () => {
    expect(clientIp('', '10.0.0.9', 1)).toBe('10.0.0.9');
    expect(clientIp('200.1.1.1', '10.0.0.9', 3)).toBe('10.0.0.9');
  });
});
