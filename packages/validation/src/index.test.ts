import { describe, expect, it } from 'vitest';
import { loginSchema } from './index.js';

describe('loginSchema', () => {
  it('normalizes valid emails', () => {
    expect(
      loginSchema.parse({ email: ' OWNER@EXAMPLE.COM ', password: 'secure-passphrase' }).email,
    ).toBe('owner@example.com');
  });
  it('rejects short passwords', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
  });
});
