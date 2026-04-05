import { wrapInLayout, ctaButton, GRAY_500 } from './base.template.js';

interface PasswordResetParams {
  agentName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetEmail(params: PasswordResetParams): { subject: string; html: string; text: string } {
  const { agentName, resetUrl, expiresInMinutes } = params;

  const subject = 'Restablecer tu contraseña — asis.chat';

  const html = wrapInLayout(
    `<p style="margin:0 0 16px;">Hola <strong>${agentName}</strong>,</p>
<p style="margin:0 0 16px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en asis.chat.</p>
${ctaButton('Restablecer contraseña', resetUrl)}
<p style="margin:0 0 16px;">Este enlace expira en <strong>${expiresInMinutes} minutos</strong>.</p>
<p style="margin:0;font-size:13px;color:${GRAY_500};">Si no solicitaste este cambio, podés ignorar este email. Tu contraseña no será modificada.</p>`,
    'Restablecer tu contraseña en asis.chat',
  );

  const text = `Hola ${agentName},

Recibimos una solicitud para restablecer la contraseña de tu cuenta en asis.chat.

Ingresá al siguiente enlace para restablecer tu contraseña:
${resetUrl}

Este enlace expira en ${expiresInMinutes} minutos.

Si no solicitaste este cambio, podés ignorar este email.`;

  return { subject, html, text };
}
