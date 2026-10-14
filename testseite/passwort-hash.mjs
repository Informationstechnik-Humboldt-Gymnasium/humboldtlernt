// Erzeugt Argon2id-Hashes (je Aufruf mit eigenem, zufälligem Salt) für die Testkonten der Testseite.
// Das Klartextpasswort wird nur über die Umgebungsvariable TEST_PASSWORT übergeben und nirgends gespeichert.
//
//   TEST_PASSWORT='…' node testseite/passwort-hash.mjs 6
//
// Die ausgegebenen Hashes kommen nach testseite/schule-daten.js (Feld HASHES).
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PARAMETER = { parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32 };   // OWASP-Empfehlung für Argon2id

export function ladeArgon2() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const ctx = { WebAssembly, TextEncoder, TextDecoder };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'vendor/argon2.umd.min.js'), 'utf8'), ctx, { filename: 'argon2.umd.min.js' });
  return ctx.hashwasm;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pw = process.env.TEST_PASSWORT;
  if (!pw) { console.error('TEST_PASSWORT ist nicht gesetzt.'); process.exit(1); }
  const n = Number(process.argv[2] || 1);
  const a = ladeArgon2();
  for (let i = 0; i < n; i++) {
    console.log(await a.argon2id({ ...PARAMETER, password: pw, salt: crypto.randomBytes(16), outputType: 'encoded' }));
  }
}
