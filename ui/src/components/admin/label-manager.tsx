"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLabelStore } from "@/stores/label.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LABEL_COLORS, LABEL_COLOR_KEYS } from "@/lib/label-colors";
import { LabelBadge } from "@/components/chat/label-badge";

export function LabelManager() {
  const { labels, isLoading, fetch, createLabel, updateLabel, deleteLabel } =
    useLabelStore();
  const { t } = useTranslations();

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
    if (!confirm(t.admin.deleteLabelConfirm)) return;
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
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t.admin.labels}</h2>
        {!creating && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t.admin.createLabel}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Create form */}
      {creating && (
        <div className="border rounded-lg p-3 space-y-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.admin.labelName}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">{t.admin.labelColor}</span>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_COLOR_KEYS.map((key) => {
                const c = LABEL_COLORS[key];
                return (
                  <button
                    key={key}
                    onClick={() => setNewColor(key)}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${
                      newColor === key
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.fg }}
                  />
                );
              })}
            </div>
          </div>
          {newName && (
            <div>
              <span className="text-xs text-muted-foreground mr-2">Preview:</span>
              <LabelBadge name={newName} color={newColor} />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {t.admin.createLabel}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setError(""); }}>
              <X className="h-3.5 w-3.5 mr-1" />
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}

      {/* Label list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.contactPanel.loading}</p>
      ) : labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.contactPanel.noLabels}</p>
      ) : (
        <div className="space-y-1">
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted transition-colors group"
            >
              {editId === label.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    {LABEL_COLOR_KEYS.map((key) => {
                      const c = LABEL_COLORS[key];
                      return (
                        <button
                          key={key}
                          onClick={() => setEditColor(key)}
                          className={`h-4 w-4 rounded-full border transition-all ${
                            editColor === key
                              ? "border-foreground scale-110"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: c.fg }}
                        />
                      );
                    })}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleUpdate}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <LabelBadge name={label.name} color={label.color} />
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => startEdit(label)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => handleDelete(label.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
