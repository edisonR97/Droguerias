import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyLicenseToken, type LicensePayload } from './licensing.service';

function token(payload: LicensePayload) {
  const keys = generateKeyPairSync('ed25519');
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'FARMACORE-LICENSE' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(null, Buffer.from(`${header}.${body}`), keys.privateKey).toString(
    'base64url',
  );
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return {
    value: `${header}.${body}.${signature}`,
    publicKey: Buffer.from(publicKey).toString('base64'),
  };
}

const base: LicensePayload = {
  version: 1,
  licenseId: 'lic-001',
  kind: 'SUBSCRIPTION',
  customerName: 'Drogueria Demo',
  taxId: '900123456',
  issuedAt: '2026-10-01T00:00:00.000Z',
  expiresAt: '2026-12-01T00:00:00.000Z',
  maxBranches: 2,
  maxUsers: 10,
  features: ['core', 'electronic-invoicing'],
};

describe('verifyLicenseToken', () => {
  it('acepta una suscripcion Ed25519 valida', () => {
    const signed = token(base);
    expect(
      verifyLicenseToken(signed.value, signed.publicKey, new Date('2026-10-12')).payload,
    ).toEqual(base);
  });

  it('rechaza una licencia alterada', () => {
    const signed = token(base);
    expect(() =>
      verifyLicenseToken(`${signed.value}x`, signed.publicKey, new Date('2026-10-12')),
    ).toThrow(/firma/);
  });

  it('acepta una licencia perpetua sin vencimiento', () => {
    const payload: LicensePayload = { ...base, kind: 'PERPETUAL' };
    delete payload.expiresAt;
    const signed = token(payload);
    expect(
      verifyLicenseToken(signed.value, signed.publicKey, new Date('2026-10-12')).payload.kind,
    ).toBe('PERPETUAL');
  });
});
