import { describe, expect, it } from 'vitest';
import { validSetupToken } from './provisioning.service';

describe('validSetupToken', () => {
  const token = 'setup-token-with-at-least-32-characters';
  it('acepta el token configurado', () => expect(validSetupToken(token, token)).toBe(true));
  it('rechaza un token diferente', () => expect(validSetupToken(`${token}x`, token)).toBe(false));
  it('rechaza configuraciones debiles', () =>
    expect(validSetupToken('short', 'short')).toBe(false));
});
