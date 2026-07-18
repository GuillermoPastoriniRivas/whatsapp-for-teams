export interface StatusUpdateInput {
  waMessageId: string;
  status: string;
  timestamp: Date;
  errors?: Array<{ code: number; title: string }>;
}
