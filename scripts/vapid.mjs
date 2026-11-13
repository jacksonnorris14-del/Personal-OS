/* Generate a VAPID key pair for web push.
   The public key goes in push-config.json (committed, safe).
   The private key goes in the repo secret VAPID_PRIVATE_KEY — never commit it. */
import { generateKeyPairSync } from 'crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const raw = publicKey.export({ type: 'spki', format: 'der' }).slice(-65);
const b64 = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

console.log('Public  (push-config.json):', b64(raw));
console.log('Private (VAPID_PRIVATE_KEY secret):', privateKey.export({ format: 'jwk' }).d);
