import { wrapInLayout, ctaButton, GRAY_500 } from './base.template.js';

interface AgentInvitationParams {
  agentName: string;
  inviterName: string;
  tenantName: string;
  inviteUrl: string;
  expiresInHours: number;
}

export function agentInvitationEmail(params: AgentInvitationParams): { subject: string; html: string; text: string } {
  const { agentName, inviterName, tenantName, inviteUrl, expiresInHours } = params;

  const subject = `Te invitaron a unirte a ${tenantName} en asis.chat`;

  const html = wrapInLayout(
    `<p style="margin:0 0 16px;">Hola <strong>${agentName}</strong>,</p>
<p style="margin:0 0 16px;"><strong>${inviterName}</strong> te invitó a unirte al equipo de <strong>${tenantName}</strong> en asis.chat.</p>
<p style="margin:0 0 16px;">Para comenzar, hacé click en el siguiente botón y creá tu contraseña:</p>
${ctaButton('Aceptar invitación', inviteUrl)}
<p style="margin:0 0 16px;">Esta invitación expira en <strong>${expiresInHours} horas</strong>.</p>
<p style="margin:0;font-size:13px;color:${GRAY_500};">Si no esperabas esta invitación, podés ignorar este email.</p>`,
    `${inviterName} te invitó a unirte a ${tenantName} en asis.chat`,
  );

  const text = `Hola ${agentName},

${inviterName} te invitó a unirte al equipo de ${tenantName} en asis.chat.

Para comenzar, ingresá al siguiente enlace y creá tu contraseña:
${inviteUrl}

Esta invitación expira en ${expiresInHours} horas.

Si no esperabas esta invitación, podés ignorar este email.`;

  return { subject, html, text };
}
