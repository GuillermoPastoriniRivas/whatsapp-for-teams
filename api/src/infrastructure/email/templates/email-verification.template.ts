import { wrapInLayout, ctaButton, GRAY_500 } from './base.template.js';

interface EmailVerificationParams {
  agentName: string;
  verifyUrl: string;
  expiresInHours: number;
}

export function emailVerificationEmail(params: EmailVerificationParams): { subject: string; html: string; text: string } {
  const { agentName, verifyUrl, expiresInHours } = params;

  const subject = 'Confirmá tu email — asis.chat';

  const html = wrapInLayout(
    `<p style="margin:0 0 16px;">Hola <strong>${agentName}</strong>,</p>
<p style="margin:0 0 16px;">¡Bienvenido/a a asis.chat! Para activar tu cuenta, confirmá tu dirección de email.</p>
${ctaButton('Confirmar email', verifyUrl)}
<p style="margin:0 0 16px;">Este enlace expira en <strong>${expiresInHours} horas</strong>.</p>
<p style="margin:0;font-size:13px;color:${GRAY_500};">Si no creaste una cuenta en asis.chat, podés ignorar este email.</p>`,
    'Confirmá tu email en asis.chat',
  );

  const text = `Hola ${agentName},

¡Bienvenido/a a asis.chat! Para activar tu cuenta, confirmá tu dirección de email ingresando al siguiente enlace:
${verifyUrl}

Este enlace expira en ${expiresInHours} horas.

Si no creaste una cuenta en asis.chat, podés ignorar este email.`;

  return { subject, html, text };
}
