/** WABA-level template webhook event (status / quality / category update). */
export interface TemplateEventInput {
  wabaId: string;
  field: string;
  metaTemplateId: string | null;
  name: string;
  language: string;
  /** message_template_status_update: APPROVED / REJECTED / PAUSED / DISABLED / ... */
  event?: string;
  reason?: string | null;
  /** message_template_quality_update */
  newQualityScore?: string;
  /** template_category_update */
  newCategory?: string;
}
