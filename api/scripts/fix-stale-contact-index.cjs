/**
 * Borra el índice muerto `tenantId_1_waId_1` de la colección `contacts`.
 *
 * Por qué existe este script: `waId` se renombró hace tiempo y ya no es un
 * campo del schema de Contact, pero el índice quedó en las bases que venían de
 * la versión vieja. Es UNIQUE y no es sparse ni parcial, así que hoy indexa
 * `waId: null` para todo contacto nuevo: un tenant no puede tener más de un
 * contacto creado después del rename. Rompe `seed:demo` y la creación de
 * contactos de cualquier tenant.
 *
 *   node api/scripts/fix-stale-contact-index.cjs
 *
 * Toma la URI de `api/.env` (no borra ni modifica ningún documento). Si hiciera
 * falta volver atrás:
 *   db.contacts.createIndex({ tenantId: 1, waId: 1 }, { unique: true })
 */
const fs = require('node:fs');
const path = require('node:path');
const { connect, connection } = require('mongoose');

const STALE_INDEX = 'tenantId_1_waId_1';

function mongoUriFromEnvFile() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const envPath = path.join(__dirname, '..', '.env');
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('MONGODB_URI='));
  if (!line) throw new Error(`No hay MONGODB_URI en ${envPath}`);
  return line.slice('MONGODB_URI='.length).trim();
}

/** La URI trae usuario y contraseña: nunca va entera a los logs. */
function safeUri(uri) {
  try {
    const url = new URL(uri);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return '(uri invalida)';
  }
}

(async () => {
  const uri = mongoUriFromEnvFile();
  console.log(`Conectando a ${safeUri(uri)}...`);
  await connect(uri);

  const contacts = connection.db.collection('contacts');
  const before = (await contacts.indexes()).map((i) => i.name);
  console.log('Índices antes:', before.join(', '));

  if (before.includes(STALE_INDEX)) {
    await contacts.dropIndex(STALE_INDEX);
    console.log(`→ ${STALE_INDEX} eliminado`);
  } else {
    console.log(`→ ${STALE_INDEX} no estaba, nada que hacer`);
  }

  console.log('Índices ahora:', (await contacts.indexes()).map((i) => i.name).join(', '));
  await connection.close();
})().catch((err) => {
  console.error('Falló:', err.message);
  process.exit(1);
});
