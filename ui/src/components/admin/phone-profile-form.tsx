"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SimpleSelect } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useBusinessVerticals } from "./business-verticals";
import type { WhatsAppBusinessProfile, WhatsAppBusinessProfileView, PhoneNumber } from "@/types";

/** Topes de Meta. Se muestran como contador para no enterarse al guardar. */
const LIMITS = { about: 139, address: 256, description: 512, email: 128 } as const;
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

const EMPTY: WhatsAppBusinessProfile = {
  about: null,
  address: null,
  description: null,
  email: null,
  vertical: null,
  websites: [],
  profilePictureUrl: null,
};

interface Props {
  phone: PhoneNumber;
  onUpdated?: () => void;
}

/**
 * Perfil de negocio del número: la foto, el "about", la descripción y los datos
 * de contacto que el cliente ve al tocar el nombre del chat.
 *
 * El dato vive en Meta, no acá: se lee al abrir y se escribe al guardar. Si la
 * API no lo expone se devuelve 400 y la sección se reemplaza por un aviso.
 */
export function PhoneProfileForm({ phone, onUpdated }: Props) {
  const { t } = useTranslations();
  const verticals = useBusinessVerticals();
  const fileInput = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<WhatsAppBusinessProfileView | null>(null);
  const [form, setForm] = useState<WhatsAppBusinessProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUnsupported(false);
    setError(null);
    setSuccess(null);

    api
      .get<WhatsAppBusinessProfileView>(`/phone-numbers/${phone.id}/profile`)
      .then((result) => {
        if (!active) return;
        setView(result);
        setForm(result.profile);
      })
      .catch((err: unknown) => {
        if (!active) return;
        // El backend responde 400 cuando el proveedor no tiene perfil de negocio.
        setUnsupported(true);
        setError(err instanceof Error ? err.message : t.admin.profileLoadError);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [phone.id, t.admin.profileLoadError]);

  const set = (patch: Partial<WhatsAppBusinessProfile>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSuccess(null);
  };

  const setWebsite = (index: number, value: string) => {
    const websites = [form.websites[0] ?? "", form.websites[1] ?? ""];
    websites[index] = value;
    set({ websites });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const profile = await api.patch<WhatsAppBusinessProfile>(`/phone-numbers/${phone.id}/profile`, {
        about: form.about ?? "",
        address: form.address ?? "",
        description: form.description ?? "",
        email: form.email ?? "",
        vertical: form.vertical || "UNDEFINED",
        websites: form.websites.map((w) => w.trim()).filter(Boolean),
      });
      setForm(profile);
      setView((prev) => (prev ? { ...prev, profile, stale: false, staleReason: null } : prev));
      setSuccess(t.admin.profileSaved);
      onUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.admin.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handlePicture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Se limpia ya: si no, elegir el mismo archivo dos veces no dispara el change.
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error(t.admin.pictureFormatError);
      return;
    }
    if (file.size > MAX_PICTURE_BYTES) {
      toast.error(t.admin.pictureSizeError);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const profile = await api.upload<WhatsAppBusinessProfile>(`/phone-numbers/${phone.id}/profile/picture`, body);
      setForm(profile);
      setView((prev) => (prev ? { ...prev, profile } : prev));
      toast.success(t.admin.pictureUpdated);
      onUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.admin.pictureError);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (unsupported) {
    return (
      <div className="px-4 py-4">
        <InlineNotice variant="info">{t.admin.profileUnsupported}</InlineNotice>
      </div>
    );
  }

  const canChangePicture = view?.canChangePicture ?? false;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
      {view?.stale && (
        <InlineNotice variant="warning">
          {t.admin.profileStale}
          {view.staleReason ? ` (${view.staleReason})` : ""}
        </InlineNotice>
      )}

      {/* Foto */}
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground">
          {form.profilePictureUrl ? (
            // Imagen del CDN de Meta: no pasa por el optimizador de Next.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.profilePictureUrl} alt="" className="size-full object-cover" />
          ) : (
            <Store className="size-6" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canChangePicture || uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? <Spinner size="sm" /> : <Camera className="size-4" />}
            {uploading ? t.admin.pictureUploading : t.admin.pictureChange}
          </Button>
          <p className="text-xs text-muted-foreground">
            {canChangePicture ? t.admin.pictureHint : t.admin.pictureUnsupported}
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handlePicture}
        />
      </div>

      <Field label={t.admin.profileAbout} hint={`${(form.about ?? "").length}/${LIMITS.about}`}>
        <Input
          value={form.about ?? ""}
          maxLength={LIMITS.about}
          onChange={(e) => set({ about: e.target.value })}
          placeholder={t.admin.profileAboutPlaceholder}
        />
      </Field>

      <Field label={t.admin.profileDescription} hint={`${(form.description ?? "").length}/${LIMITS.description}`}>
        <Textarea
          value={form.description ?? ""}
          maxLength={LIMITS.description}
          rows={3}
          onChange={(e) => set({ description: e.target.value })}
          placeholder={t.admin.profileDescriptionPlaceholder}
        />
      </Field>

      <Field label={t.admin.profileVertical} hint={t.admin.profileVerticalHint}>
        <SimpleSelect
          value={form.vertical ?? "UNDEFINED"}
          onChange={(value) => set({ vertical: value })}
          options={verticals}
        />
      </Field>

      <Field label={t.admin.profileAddress}>
        <Input
          value={form.address ?? ""}
          maxLength={LIMITS.address}
          onChange={(e) => set({ address: e.target.value })}
          placeholder={t.admin.profileAddressPlaceholder}
        />
      </Field>

      <Field label={t.admin.profileEmail}>
        <Input
          type="email"
          value={form.email ?? ""}
          maxLength={LIMITS.email}
          onChange={(e) => set({ email: e.target.value })}
          placeholder={t.admin.profileEmailPlaceholder}
        />
      </Field>

      {/* Dos campos y no una lista: WhatsApp acepta exactamente dos sitios. */}
      <Field label={t.admin.profileWebsite1} hint={t.admin.profileWebsitesHint}>
        <Input
          value={form.websites[0] ?? ""}
          onChange={(e) => setWebsite(0, e.target.value)}
          placeholder="https://tunegocio.com"
        />
      </Field>

      <Field label={t.admin.profileWebsite2}>
        <Input
          value={form.websites[1] ?? ""}
          onChange={(e) => setWebsite(1, e.target.value)}
          placeholder="https://instagram.com/tunegocio"
        />
      </Field>

      {error && <InlineNotice variant="error">{error}</InlineNotice>}
      {!error && success && <InlineNotice variant="success">{success}</InlineNotice>}

      <div className="flex justify-end pt-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Spinner size="sm" />}
          {saving ? t.common.saving : t.common.save}
        </Button>
      </div>
    </form>
  );
}
