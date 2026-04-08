"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Mail, Building2, Loader2, TextIcon } from "lucide-react";
import { api } from "@/lib/api";

interface ContactData {
  id: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  customFields: Record<string, string>;
}

interface Props {
  contact: ContactData;
  onUpdated: (fields: Partial<ContactData>) => void;
}

function InlineField({
  icon: Icon,
  label,
  value,
  onSave,
  type = "text",
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = draft.trim();
    const newValue = trimmed || null;
    // Skip save if value didn't change
    if (newValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(newValue);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-3 min-h-[44px]">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 relative">
          <Input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            onBlur={handleSave}
            placeholder={label}
            className="h-9 text-sm pr-8"
            autoFocus
            disabled={saving}
          />
          {saving && (
            <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className="flex items-center gap-3 min-h-[44px] w-full text-left rounded-lg px-1 -mx-1 active:bg-muted/60 transition-colors"
    >
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      {value ? (
        <span className="text-sm">{value}</span>
      ) : (
        <span className="text-sm text-muted-foreground">
          {label}
        </span>
      )}
    </button>
  );
}

export function ContactFields({ contact, onUpdated }: Props) {
  const saveField = async (field: keyof ContactData, value: string | null) => {
    await api.patch(`/contacts/${contact.id}`, { [field]: value });
    onUpdated({ [field]: value });
  };

  const saveCustomField = async (key: string, value: string | null) => {
    const updated = { ...contact.customFields };
    if (value === null) {
      delete updated[key];
    } else {
      updated[key] = value;
    }
    await api.patch(`/contacts/${contact.id}`, { customFields: updated });
    onUpdated({ customFields: updated } as Partial<ContactData>);
  };

  return (
    <div className="space-y-0.5">
      <InlineField
        icon={Mail}
        label="Add email"
        value={contact.email}
        type="email"
        onSave={(v) => saveField("email", v)}
      />
      <InlineField
        icon={Building2}
        label="Add company"
        value={contact.company}
        onSave={(v) => saveField("company", v)}
      />
      {Object.entries(contact.customFields).map(([key, value]) => (
        <InlineField
          key={key}
          icon={TextIcon}
          label={key}
          value={value}
          onSave={(v) => saveCustomField(key, v)}
        />
      ))}
    </div>
  );
}
