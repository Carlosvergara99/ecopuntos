// Plantillas de email. Cada funcion devuelve { html, text }.
// HTML con CSS inline porque algunos clientes (Outlook) ignoran <style>.
// text es fallback para clientes solo-texto.

// Header verde EcoPuntos. Usuario recien registrado.
export function welcomeEmail({ nombre, email }) {
  const html = `
<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="background:#16a34a;color:#fff;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;font-size:24px;font-weight:bold;">¡Bienvenido a EcoPuntos!</h1>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Gestión inteligente de residuos voluminosos en Bogotá</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;color:#374151;line-height:1.6;font-size:14px;">
        <p>Hola <strong>${escapeHtml(nombre)}</strong>,</p>
        <p>Tu cuenta fue creada correctamente. Ya puedes ingresar a la plataforma, ver los ecopuntos cercanos a tu dirección y agendar recolecciones de residuos voluminosos.</p>
        <table cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f3f4f6;border-radius:8px;padding:12px 16px;">
          <tr><td style="font-size:12px;color:#6b7280;">Cuenta:</td><td style="font-size:13px;color:#111827;padding-left:8px;"><strong>${escapeHtml(email)}</strong></td></tr>
        </table>
        <p style="margin-top:24px;color:#6b7280;font-size:12px;">Si no fuiste tú quien creó esta cuenta, ignora este mensaje.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:16px 24px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
        EcoPuntos Bogotá · Proyecto académico
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    `¡Bienvenido a EcoPuntos, ${nombre}!`,
    ``,
    `Tu cuenta fue creada correctamente.`,
    `Email: ${email}`,
    ``,
    `Ya puedes ingresar a la plataforma para ver ecopuntos cercanos y agendar recolecciones.`,
    ``,
    `— EcoPuntos Bogotá`,
  ].join('\n');

  return { html, text };
}

// Header azul (operacional). Confirmacion de solicitud de recoleccion.
// `nombre` es el saludo (usuario logueado). `solicitanteNombre` /
// `solicitanteTelefono` son los datos de contacto reales para el equipo
// de recoleccion — pueden ser distintos al de la cuenta.
export function solicitudConfirmEmail({ nombre, type, description, address, date, solicitanteNombre, solicitanteTelefono }) {
  const html = `
<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="background:#2563eb;color:#fff;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;font-size:22px;font-weight:bold;">Solicitud registrada</h1>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Recolección de residuos voluminosos</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;color:#374151;line-height:1.6;font-size:14px;">
        <p>Hola <strong>${escapeHtml(nombre)}</strong>,</p>
        <p>Tu solicitud quedó registrada. Un equipo de recolección se pondrá en contacto pronto.</p>
        <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#f3f4f6;border-radius:8px;border-collapse:separate;">
          <tr><td style="font-size:12px;color:#6b7280;width:38%;">Tipo:</td><td style="font-size:13px;color:#111827;text-transform:capitalize;"><strong>${escapeHtml(type)}</strong></td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Descripción:</td><td style="font-size:13px;color:#111827;">${escapeHtml(description)}</td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Contacto:</td><td style="font-size:13px;color:#111827;"><strong>${escapeHtml(solicitanteNombre ?? '')}</strong></td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Teléfono:</td><td style="font-size:13px;color:#111827;">${escapeHtml(solicitanteTelefono ?? '')}</td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Dirección:</td><td style="font-size:13px;color:#111827;">${escapeHtml(address)}</td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Fecha:</td><td style="font-size:13px;color:#111827;"><strong>${escapeHtml(date)}</strong></td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:16px 24px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
        EcoPuntos Bogotá · Proyecto académico
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    `Solicitud registrada — EcoPuntos Bogotá`,
    ``,
    `Hola ${nombre},`,
    `Tu solicitud quedó registrada. Detalles:`,
    `  Tipo: ${type}`,
    `  Descripción: ${description}`,
    `  Contacto: ${solicitanteNombre ?? ''}`,
    `  Teléfono: ${solicitanteTelefono ?? ''}`,
    `  Dirección: ${address}`,
    `  Fecha: ${date}`,
    ``,
    `Un equipo de recolección se pondrá en contacto pronto.`,
    ``,
    `— EcoPuntos Bogotá`,
  ].join('\n');

  return { html, text };
}

// Escape minimo para evitar inyeccion de HTML cuando los strings vienen
// del usuario (nombre, direccion, descripcion). NO depende de librerias.
function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
