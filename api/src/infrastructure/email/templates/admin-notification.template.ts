import { wrapInLayout, ctaButton } from './base.template.js';

interface AdminNotificationParams {
  title: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export function adminNotificationEmail(params: AdminNotificationParams): { subject: string; html: string; text: string } {
  const { title, bodyText, ctaLabel, ctaUrl } = params;

  const subject = `${title} — asis.chat`;

  const ctaHtml = ctaLabel && ctaUrl ? ctaButton(ctaLabel, ctaUrl) : '';

  const html = wrapInLayout(
    `<p style="margin:0 0 16px;font-size:18px;font-weight:600;">${title}</p>
<p style="margin:0 0 16px;">${bodyText}</p>
${ctaHtml}`,
    title,
  );

  const text = `${title}

${bodyText}
${ctaLabel && ctaUrl ? `\n${ctaLabel}: ${ctaUrl}` : ''}`;

  return { subject, html, text };
}
