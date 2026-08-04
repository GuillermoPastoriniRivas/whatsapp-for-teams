"use client";

import { useEffect, useState, type RefObject } from "react";
import { Check, Pencil, Tag, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useLabelStore } from "@/stores/label.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LABEL_COLORS, LABEL_COLOR_KEYS } from "@/lib/label-colors";
import { LabelBadge } from "@/components/chat/label-badge";
import { cn } from "@/lib/utils";

interface Props {
  /** Ver `AgentList`: la cabecera de la página abre el alta desde acá. */
  createRef?: RefObject<(() => void) | null>;
}

export function LabelManager({ createRef }: Props) {
  const { labels, isLoading, fetch, createLabel, updateLabel, deleteLabel } =
    useLabelStore();
  const { t } = useTranslations();
  const confirm = useConfirm();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("teal");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(true);
  }, []);

  useEffect(() => {
    if (createRef) createRef.current = () => setCreating(true);
  });

  async function handleCreate() {
    if (!newName.trim()) return;
    setError("");
    try {
      await createLabel(newName.trim(), newColor);
      setNewName("");
      setNewColor("teal");
      setCreating(false);
    } catch (e: any) {
      setError(e.message || t.admin.labelNameExists);
    }
  }

  async function handleUpdate() {
    if (!editId || !editName.trim()) return;
    setError("");
    try {
      await updateLabel(editId, { name: editName.trim(), color: editColor });
      setEditId(null);
    } catch (e: any) {
      setError(e.message || t.admin.labelNameExists);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.admin.deleteLabel,
      description: t.admin.deleteLabelConfirm,
      confirmLabel: t.common.delete,
      destructive: true,
    });
    if (!ok) return;
    await deleteLabel(id);
  }

  function startEdit(label: { id: string; name: string; color: string }) {
    setEditId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
    setError("");
  }

  return (
    <div className="space-y-4">
      {error && <InlineNotice variant="error">{error}</InlineNotice>}

      {/* Create form */}
      {creating && (
        <div className="space-y-3 rounded-xl border p-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.admin.labelName}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{t.admin.labelColor}</p>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={newColor === key}
                  onClick={() => setNewColor(key)}
                  className={cn(
                    "size-6 rounded-full border-2 transition-all",
                    newColor === key ? "scale-110 border-foreground" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: LABEL_COLORS[key].fg }}
                />
              ))}
            </div>
          </div>
          {newName && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t.admin.labelPreview}</span>
              <LabelBadge name={newName} color={newColor} />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>
              <Check className="size-4" />
              {t.admin.createLabel}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setError(""); }}>
              <X className="size-4" />
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}

      {/* Label list */}
      {isLoading ? (
        <LoadingState />
      ) : labels.length === 0 ? (
        <EmptyState icon={Tag} title={t.contactPanel.noLabels} />
      ) : (
        <div className="space-y-1">
          {labels.map((label) => (
            <div
              key={label.id}
              className="group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
            >
              {editId === label.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    {LABEL_COLOR_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-label={key}
                        aria-pressed={editColor === key}
                        onClick={() => setEditColor(key)}
                        className={cn(
                          "size-4 rounded-full border transition-all",
                          editColor === key ? "scale-110 border-foreground" : "border-transparent"
                        )}
                        style={{ backgroundColor: LABEL_COLORS[key].fg }}
                      />
                    ))}
                  </div>
                  <Button size="icon-sm" variant="ghost" onClick={handleUpdate} aria-label={t.common.save}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditId(null)} aria-label={t.common.cancel}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <LabelBadge name={label.name} color={label.color} />
                  <div className="flex-1" />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t.admin.editLabel}
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => startEdit(label)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t.admin.deleteLabel}
                    className="text-destructive opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => handleDelete(label.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
