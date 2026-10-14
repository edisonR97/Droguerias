import { randomUUID, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const args = new Map();
const cli = process.argv.slice(2).filter((value) => value !== '--');
for (let index = 0; index < cli.length; index += 2) args.set(cli[index], cli[index + 1]);
const required = ['--private-key', '--tax-id', '--customer', '--kind', '--output'];
for (const key of required) if (!args.get(key)) throw new Error(`Falta ${key}`);
const kind = String(args.get('--kind')).toUpperCase();
if (!['SUBSCRIPTION', 'PERPETUAL'].includes(kind))
  throw new Error('--kind debe ser subscription o perpetual');
const expiresAt = args.get('--expires');
if (kind === 'SUBSCRIPTION' && !expiresAt)
  throw new Error('Las suscripciones requieren --expires en formato ISO');
if (kind === 'PERPETUAL' && expiresAt) throw new Error('Una licencia perpetua no admite --expires');
if (expiresAt && Number.isNaN(new Date(expiresAt).getTime()))
  throw new Error('--expires no es valido');
const payload = {
  version: 1,
  licenseId: randomUUID(),
  kind,
  customerName: args.get('--customer'),
  taxId: args.get('--tax-id'),
  issuedAt: new Date().toISOString(),
  ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
  maxBranches: Number(args.get('--max-branches') ?? 1),
  maxUsers: Number(args.get('--max-users') ?? 3),
  features: String(args.get('--features') ?? 'core')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
};
if (!Number.isInteger(payload.maxBranches) || payload.maxBranches < 1)
  throw new Error('--max-branches no es valido');
if (!Number.isInteger(payload.maxUsers) || payload.maxUsers < 1)
  throw new Error('--max-users no es valido');
const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'FARMACORE-LICENSE' })).toString(
  'base64url',
);
const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
const signature = sign(
  null,
  Buffer.from(`${header}.${body}`),
  readFileSync(args.get('--private-key')),
).toString('base64url');
writeFileSync(args.get('--output'), `${header}.${body}.${signature}\n`, { mode: 0o600 });
console.info(`Licencia ${payload.licenseId} creada en ${args.get('--output')}`);
