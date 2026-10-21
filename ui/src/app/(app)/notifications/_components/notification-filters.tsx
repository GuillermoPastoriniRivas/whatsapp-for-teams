"use client";

import { FilterPill } from "@/components/ui/filter-pill";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n/use-translations";
import { NOTIFICATION_STATUSES, type NotificationStatus } from "@/stores/notification.store";
import { useNotificationStatusLabels } from "./notification-status-pill";

/**
 * Filtros del historial de notificaciones.
 *
 * Los de estado van en la cabecera (como las pestañas de campañas y
 * plantillas) y los de plantilla y fecha en el contenido, que es donde el
 * resto de la app pone los selectores con más de un campo.
 */

export interface NotificationStatusFilterProps {
  value: NotificationStatus | "";
  onChange: (status: NotificationStatus | "") => void;
}

export function NotificationStatusFilter({ value, onChange }: NotificationStatusFilterProps) {
  const { t } = useTranslations();
  const labels = useNotificationStatusLabels();

  return (
    <>
      <FilterPill active={value === ""} onClick={() => onChange("")}>
        {t.notifications.logFilterAll}
      </FilterPill>
      {NOTIFICATION_STATUSES.map((status) => (
        <FilterPill key={status} active={value === status} onClick={() => onChange(status)}>
          {labels[status]}
        </FilterPill>
      ))}
    </>
  );
}

export interface NotificationFiltersProps {
  templateId: string;
  onTemplateChange: (templateId: string) => void;
  /** Opciones de plantilla: id de la plantilla y nombre visible. */
  templateOptions: { id: string; name: string }[];
  from: string;
  onFromChange: (from: string) => void;
  to: string;
  onToChange: (to: string) => void;
}

export function NotificationFilters({
  templateId,
  onTemplateChange,
  templateOptions,
  from,
  onFromChange,
  to,
  onToChange,
}: NotificationFiltersProps) {
  const { t } = useTranslations();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={t.notifications.logFilterTemplate} className="w-full sm:w-56">
        <SimpleSelect
          value={templateId}
          onChange={onTemplateChange}
          // El `Field` ata la etiqueta con `htmlFor`, pero el disparador del
          // select es un botón: sin `aria-label` el control no queda con
          // nombre accesible.
          aria-label={t.notifications.logFilterTemplate}
          options={[
            { value: "", label: t.notifications.logFilterAllTemplates },
            ...templateOptions.map((option) => ({ value: option.id, label: option.name })),
          ]}
        />
      </Field>
      <Field label={t.notifications.logFilterFrom} className="w-full sm:w-40">
        <Input type="date" value={from} onChange={(event) => onFromChange(event.target.value)} />
      </Field>
      <Field label={t.notifications.logFilterTo} className="w-full sm:w-40">
        <Input type="date" value={to} onChange={(event) => onToChange(event.target.value)} />
      </Field>
    </div>
  );
}
