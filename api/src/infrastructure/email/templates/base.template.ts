const TEAL = '#0D9488';
const TEAL_DARK = '#0B7A70';
const ORANGE = '#F97316';
const GRAY_50 = '#F9FAFB';
const GRAY_300 = '#D1D5DB';
const GRAY_500 = '#6B7280';
const GRAY_700 = '#374151';
const GRAY_900 = '#111827';

export function wrapInLayout(bodyHtml: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>asis.chat</title>
</head>
<body style="margin:0;padding:0;background-color:${GRAY_50};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${GRAY_50};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:${TEAL};padding:28px 32px;text-align:center;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">asis.chat</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:${GRAY_700};font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid ${GRAY_300};text-align:center;">
              <p style="margin:0;font-size:12px;color:${GRAY_500};">
                &copy; ${new Date().getFullYear()} asis.chat &mdash; Plataforma de atenci&oacute;n al cliente
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:${GRAY_500};">
                <a href="https://asis.chat" style="color:${TEAL};text-decoration:none;">asis.chat</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
  <tr>
    <td style="background-color:${TEAL};border-radius:8px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

export { TEAL, TEAL_DARK, ORANGE, GRAY_50, GRAY_300, GRAY_500, GRAY_700, GRAY_900 };
