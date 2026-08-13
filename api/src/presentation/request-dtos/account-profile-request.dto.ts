import { z } from 'zod';

const HoursRange = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

const BusinessHoursSchema = z
  .object({
    monday: HoursRange.nullable().optional(),
    tuesday: HoursRange.nullable().optional(),
    wednesday: HoursRange.nullable().optional(),
    thursday: HoursRange.nullable().optional(),
    friday: HoursRange.nullable().optional(),
    saturday: HoursRange.nullable().optional(),
    sunday: HoursRange.nullable().optional(),
  })
  .nullable();

export const UpdateAccountProfileRequestSchema = z.object({
  businessProfile: z
    .object({
      vertical: z.enum(['beauty', 'food', 'retail', 'generic']),
      businessName: z.string().max(120),
      description: z.string().max(2000),
      address: z.string().max(300),
      paymentMethods: z.string().max(500),
      catalog: z
        .array(
          z.object({
            name: z.string().max(120),
            price: z.string().max(60),
            description: z.string().max(500),
          }),
        )
        .max(200),
      faqs: z
        .array(z.object({ question: z.string().max(300), answer: z.string().max(2000) }))
        .max(100),
      extraNotes: z.string().max(4000),
      assistantInstructions: z.string().max(8000).default(''),
    })
    .optional(),
  timezone: z.string().max(60).nullable().optional(),
  businessHours: BusinessHoursSchema.optional(),
});
export type UpdateAccountProfileRequestDto = z.infer<typeof UpdateAccountProfileRequestSchema>;
