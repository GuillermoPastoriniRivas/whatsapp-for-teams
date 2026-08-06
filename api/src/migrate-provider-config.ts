/**
 * Cifra en reposo las credenciales que quedaron en texto plano en
 * `phone_numbers.providerConfig`.
 *
 * ORDEN OBLIGATORIO: desplegar primero el codigo que sabe descifrar y despues
 * correr esto. Al reves, las instancias con codigo viejo leen el ciphertext
 * como si fuera el token y **se cae el envio de mensajes**.
 *
 * Es idempotente y seguro de correr varias veces: `encryptProviderConfig` no
 * vuelve a cifrar lo que ya esta cifrado.
 *
 *   npm run migrate:provider-config -- --dry-run   # muestra que haria
 *   npm run migrate:provider-config                # aplica
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { encryptProviderConfig, isEncrypted } from './infrastructure/crypto/provider-config.cipher.js';

const SECRET_KEYS = ['accessToken', 'authToken', 'apiKey'];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI');
  if (!process.env.FLOW_SECRETS_KEY) throw new Error('Falta FLOW_SECRETS_KEY');

  await mongoose.connect(uri);
  const col = mongoose.connection.collection('phone_numbers');
  const docs = await col.find({}).toArray();

  console.log(`${docs.length} numeros en la base${dryRun ? ' (DRY RUN, no escribe)' : ''}\n`);

  let migrated = 0;
  let alreadyDone = 0;

  for (const doc of docs) {
    const cfg = (doc.providerConfig ?? {}) as Record<string, string>;
    const pending = SECRET_KEYS.filter((k) => typeof cfg[k] === 'string' && cfg[k] && !isEncrypted(cfg[k]));

    const label = `${doc.displayPhone ?? doc.phoneNumberId} (${doc.provider})`;
    if (pending.length === 0) {
      alreadyDone++;
      console.log(`  = ${label}: ya cifrado o sin secretos`);
      continue;
    }

    if (dryRun) {
      console.log(`  ~ ${label}: cifraria ${pending.join(', ')}`);
      migrated++;
      continue;
    }

    const encrypted = encryptProviderConfig(cfg)!;

    // Verificacion antes de escribir: el ida y vuelta tiene que devolver
    // exactamente el valor original. Si no, no se toca el documento.
    const { decryptProviderConfig } = await import('./infrastructure/crypto/provider-config.cipher.js');
    const roundTrip = decryptProviderConfig(encrypted);
    const ok = SECRET_KEYS.every((k) => (cfg[k] ?? null) === (roundTrip[k] ?? null));
    if (!ok) {
      console.error(`  ! ${label}: el ida y vuelta no coincide, NO se migra`);
      continue;
    }

    await col.updateOne({ _id: doc._id }, { $set: { providerConfig: encrypted } });
    migrated++;
    console.log(`  + ${label}: cifrado ${pending.join(', ')}`);
  }

  console.log(`\n${migrated} migrados, ${alreadyDone} sin cambios`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
