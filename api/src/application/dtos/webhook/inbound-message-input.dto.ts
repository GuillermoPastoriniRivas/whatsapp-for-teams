export interface InboundMessageInput {
  phoneNumberId: string;
  waMessageId: string;
  from: string;
  contactName: string;
  profilePicUrl?: string;
  messageType: string;
  body?: string;
  mediaUrl?: string;
  mimeType?: string;
  timestamp: Date;
}
