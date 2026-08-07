/** Evento de salud de la cuenta o del número, tal como llega del webhook. */
export interface AccountEventInput {
  wabaId: string;
  /** `account_update`, `phone_number_quality_update`, … */
  field: string;
  /** Número al que aplica (dígitos). Null = toda la WABA. */
  displayPhoneNumber: string | null;
  value: Record<string, unknown>;
}

/** El usuario prendió o apagó los mensajes de marketing. */
export interface UserPreferenceInput {
  wabaId: string;
  phone: string | null;
  bsuid: string | null;
  optedOut: boolean;
  timestamp: Date;
}
