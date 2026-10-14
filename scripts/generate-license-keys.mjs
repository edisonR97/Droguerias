import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cli = process.argv.slice(2).filter((value) => value !== '--');
const output = resolve(cli[0] ?? '.local/license-keys');
mkdirSync(output, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
writeFileSync(resolve(output, 'farmacore-license-public.pem'), publicPem, { mode: 0o644 });
writeFileSync(resolve(output, 'farmacore-license-private.pem'), privatePem, { mode: 0o600 });
writeFileSync(
  resolve(output, 'public-key-base64.txt'),
  `${Buffer.from(publicPem).toString('base64')}\n`,
  { mode: 0o644 },
);
console.info(`Claves creadas en ${output}`);
console.info(
  'La clave privada nunca debe copiarse a equipos de clientes ni incluirse en instaladores.',
);
