import { z } from 'zod';
import { CampaignStatus } from '../../domain/enums/campaign-status.enum.js';
import { CampaignRecipientStatus } from '../../domain/enums/campaign-recipient-status.enum.js';

export const CampaignQueryParamsSchema = z.object({
  status: z.nativeEnum(CampaignStatus).optional(),
  phoneNumberId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CampaignQueryParamsDto = z.infer<typeof CampaignQueryParamsSchema>;

export const CampaignRecipientQueryParamsSchema = z.object({
  status: z.nativeEnum(CampaignRecipientStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CampaignRecipientQueryParamsDto = z.infer<typeof CampaignRecipientQueryParamsSchema>;
