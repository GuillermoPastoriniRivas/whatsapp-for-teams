export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: EmailRecipient | EmailRecipient[];
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailServicePort {
  send(message: EmailMessage): Promise<void>;
}
