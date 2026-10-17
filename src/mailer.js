// E-Mail-Versand für das Feedback (nur Server). Zugangsdaten kommen ausschließlich aus der .env (SMTP_*),
// nie aus dem Repo. Ohne SMTP_HOST ist der Versand aus – die Feedback-Seite öffnet dann das eigene E-Mail-Programm.
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { config } from './config.js';

const EMAIL = /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;]+$/;
export const istEmail = s => EMAIL.test(String(s || ''));

/** Empfänger: FEEDBACK_AN aus der .env, sonst content/feedback.json. */
export function feedbackEmpfaenger() {
  if (istEmail(config.feedback.an)) return config.feedback.an;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(config.contentDir, 'feedback.json'), 'utf8'));
    return istEmail(d.empfaenger) ? d.empfaenger : '';
  } catch { return ''; }
}

/** Ist der Versand über den Server eingerichtet? */
export function mailBereit() {
  const s = config.feedback.smtp;
  return Boolean(s.host && istEmail(s.from || s.user) && feedbackEmpfaenger());
}

let transport = null;
function holeTransport() {
  if (transport) return transport;
  const s = config.feedback.smtp;
  transport = nodemailer.createTransport({
    host: s.host, port: s.port, secure: s.secure, requireTLS: !s.secure && s.requireTLS,
    auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    disableFileAccess: true, disableUrlAccess: true,   // Nachrichten dürfen keine Dateien oder URLs nachladen
    connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
  });
  return transport;
}

/** Schickt eine reine Text-Mail an den Feedback-Empfänger. antwortAn: optionale Reply-To-Adresse. */
export async function sendeFeedbackMail({ betreff, text, antwortAn }) {
  const s = config.feedback.smtp;
  await holeTransport().sendMail({
    from: { name: config.siteName + ' – Feedback', address: s.from || s.user },
    to: feedbackEmpfaenger(),
    replyTo: istEmail(antwortAn) ? antwortAn : undefined,
    subject: betreff,
    text,
  });
}
