// ──────────────────────────────────────────────────────────────
// Wrapper de email HTML — compartido entre server y cliente.
// Envuelve el body de una plantilla en la estructura HTML completa
// (header con logo, footer, estilos premium) para que se vea igual
// en el composer (preview) y en el envío real.
//
// Este archivo NO tiene dependencias server-only — se puede importar
// desde componentes "use client".
// ──────────────────────────────────────────────────────────────

/**
 * Escapa caracteres HTML para evitar inyección al insertar valores
 * en una plantilla HTML.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function wrapHtmlEmail(opts: {
  body: string;
  preheader?: string;
  logoUrl?: string | null;
  headerColor?: string | null;
  companyName?: string | null;
  logoPosition?: "left" | "center" | "right";
}): string {
  const { body, preheader, logoUrl, headerColor, companyName, logoPosition } = opts;
  if (/<html[\s>]/i.test(body)) return body;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
    : "";

  const headerBg = headerColor || "#0095DA";
  const align = logoPosition || "center";
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName || "Logo")}" style="max-height:56px;max-width:200px;display:block;" />`
    : `<span style="font-size:20px;font-weight:600;color:#ffffff;letter-spacing:0.2px;">${escapeHtml(companyName || "Empresa")}</span>`;
  const headerHtml = `<tr><td style="padding:24px 32px;background-color:${headerBg};text-align:${align};">${logoHtml}</td></tr>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Email</title>
<style>
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; }
  [data-indent="1"] { padding-left: 40px; }
  [data-indent="2"] { padding-left: 80px; }
  [data-indent="3"] { padding-left: 120px; }
  [data-indent="4"] { padding-left: 160px; }
  [data-indent="5"] { padding-left: 200px; }
  [data-indent="6"] { padding-left: 240px; }
  [data-indent="7"] { padding-left: 280px; }
  [data-indent="8"] { padding-left: 320px; }
  /* Tipografía premium */
  h1, h2, h3 { margin: 0 0 12px 0; font-weight: 600; line-height: 1.3; }
  h1 { font-size: 22px; color: #0f172a; }
  h2 { font-size: 18px; color: #1e293b; }
  h3 { font-size: 15px; color: #334155; }
  p { margin: 0 0 12px 0; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { margin: 0 0 12px 0; padding-left: 20px; }
  li { margin-bottom: 6px; }
  strong { font-weight: 600; }
  /* Cards / callouts */
  .callout { background: #f8fafc; border-left: 3px solid ${headerBg}; padding: 14px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }
  .magic-link-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .magic-link-box a { display: inline-block; padding: 10px 18px; background: ${headerBg}; color: #ffffff !important; border-radius: 6px; font-weight: 600; font-size: 14px; text-decoration: none; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px 64px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08),0 1px 3px rgba(15,23,42,0.06);">
${headerHtml}
<tr><td style="padding:32px;color:#1e293b;font-size:14px;line-height:1.7;">
${body}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;background-color:#f8fafc;color:#64748b;font-size:11px;text-align:center;line-height:1.5;">
&copy; ${new Date().getFullYear()} ${escapeHtml(companyName || "")}<br />
<span style="color:#94a3b8;">Este correo fue enviado de forma automática, por favor no responda a este mensaje.</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
