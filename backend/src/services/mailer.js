// Mailer aislado para que no acople los controllers con nodemailer.
// API publica: send({ to, subject, html, text }).
// Init lazy: lee config la primera vez. Si SMTP_USER/PASS faltan, queda
// en modo no-op (logea y devuelve sin enviar). Asi el server arranca
// tranquilo sin credenciales y los tests no se rompen.

import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;
let modoNoOp = false;

function init() {
  if (transporter !== null || modoNoOp) return;
  if (!config.smtp.user || !config.smtp.pass) {
    modoNoOp = true;
    console.warn('[mailer] SMTP no configurado (SMTP_USER/SMTP_PASS). Emails desactivados.');
    return;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  console.log(`[mailer] SMTP listo (remitente: ${config.smtp.user})`);
}

// Fire-and-forget. NO lanza errores — solo loguea. Los callers no
// necesitan try/catch.
export async function send({ to, subject, html, text }) {
  init();
  if (modoNoOp) {
    console.log(`[mailer] (no-op) ${subject} → ${to}`);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `"EcoPuntos Bogotá" <${config.smtp.user}>`,
      to,
      subject,
      html,
      text,
    });
    console.log(`[mailer] enviado a ${to}: ${info.messageId}`);
  } catch (err) {
    console.error(`[mailer] error enviando a ${to}:`, err.message);
  }
}
