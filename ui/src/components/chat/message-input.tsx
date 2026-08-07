"use client";

import { useCallback, useRef, useState } from "react";
import { useMessageStore } from "@/stores/message.store";
import { uploadMedia } from "@/stores/media.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { ACCEPTED_UPLOAD_TYPES, validateUpload } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { AttachmentPreview, type PendingAttachment } from "./attachment-preview";
import { FlowComposerNote } from "./flow-chip";
import { FolderOpen, Paperclip, SendHorizontal, Smile, Upload, X } from "lucide-react";
import type { MediaAsset } from "@/types";

interface Props {
  conversationId: string;
}

export function MessageInput({ conversationId }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const send = useMessageStore((s) => s.send);
  const replyTo = useMessageStore((s) => s.replyTo);
  const setReplyTo = useMessageStore((s) => s.setReplyTo);
  const { t } = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const attachFile = useCallback((file: File) => {
    const problem = validateUpload(file);
    setAttachment({ file });
    setAttachmentError(problem);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSend = async () => {
    const body = text.trim();
    if (sending || uploading) return;
    if (!body && !attachment) return;
    if (attachment && attachmentError) return;

    setSending(true);
    try {
      let assetId = attachment?.asset?.id;

      // El archivo se sube recién al enviar: si el agente se arrepiente, no
      // dejamos basura en el storage ni consumimos cuota.
      if (attachment?.file) {
        setUploading(true);
        const asset = await uploadMedia(attachment.file, { conversationId });
        assetId = asset.id;
        setUploading(false);
      }

      await send(conversationId, body, assetId);
      setText("");
      clearAttachment();
    } catch (error: unknown) {
      setUploading(false);
      const message =
        error instanceof ApiError ? error.message : (error as Error)?.message || t.chat.sendError;
      if (attachment) setAttachmentError(message);
      else toast.error(message);
    } finally {
      setSending(false);
      // Mantener el teclado abierto para seguir escribiendo
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** Pegar una captura directo en el chat es lo que todos esperan que funcione. */
  const handlePaste = (event: React.ClipboardEvent) => {
    const file = Array.from(event.clipboardData.files)[0];
    if (!file) return;
    event.preventDefault();
    attachFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = Array.from(event.dataTransfer.files)[0];
    if (file) attachFile(file);
  };

  const handleLibraryPick = (asset: MediaAsset) => {
    setAttachment({ asset });
    setAttachmentError(asset.available ? null : "Este archivo ya no está disponible.");
  };

  const canSend = (!!text.trim() || !!attachment) && !attachmentError && !sending && !uploading;

  return (
    <>
      <FlowComposerNote conversationId={conversationId} />

      {replyTo && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border bg-[var(--asis-surface-header)] px-4 py-2 sm:px-6">
          {/* La barra vertical es el lenguaje de la cita en WhatsApp. */}
          <span className="h-8 w-0.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary">{t.chat.replyingTo}</p>
            <p className="truncate text-xs text-muted-foreground">
              {replyTo.body || replyTo.media?.filename || t.chat.typePlaceholder}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.chat.cancelReply}
            className="shrink-0 text-muted-foreground"
            onClick={() => setReplyTo(null)}
          >
            <X />
          </Button>
        </div>
      )}

      {attachment && (
        <AttachmentPreview
          attachment={attachment}
          uploading={uploading}
          error={attachmentError}
          onCancel={clearAttachment}
        />
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex shrink-0 items-center gap-2 bg-[var(--asis-surface-header)] px-4 py-3 sm:px-6 w-full shadow-sm z-(--z-sticky) transition-colors duration-200 border-t border-border",
          dragging && "bg-primary/10 ring-2 ring-inset ring-primary/40"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_UPLOAD_TYPES}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) attachFile(file);
          }}
        />

        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full h-10 w-10">
          <Smile className="h-[22px] w-[22px]" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Adjuntar archivo"
              className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full h-10 w-10 mr-1"
            >
              <Paperclip className="h-[22px] w-[22px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Subir un archivo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Elegir de la biblioteca
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1 bg-background dark:bg-secondary flex items-center rounded-full px-4 py-1 border border-transparent focus-within:border-primary/30 shadow-sm transition-all">
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={attachment ? "Agregá un texto (opcional)" : t.chat.typePlaceholder}
            className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none bg-transparent h-[38px] text-base"
          />
        </div>

        <Button
          size="icon"
          className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-10 w-10 ml-1 shadow-sm transition-transform active:scale-95"
          onClick={handleSend}
          // Que tocar el botón no le robe el focus al input (cerraría el teclado)
          onMouseDown={(e) => e.preventDefault()}
          disabled={!canSend}
        >
          <SendHorizontal className="h-[18px] w-[18px]" />
        </Button>
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleLibraryPick}
      />
    </>
  );
}
