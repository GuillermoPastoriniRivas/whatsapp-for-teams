"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { parseCsv } from "@/lib/csv";
import type { ImportContactsResult } from "@/types";

interface CsvImportPanelProps {
  /** Called after a successful import with the API result and the imported file. */
  onImported?: (result: ImportContactsResult, file: File) => void;
  /** Embedded inside another flow (campaign wizard) — trims header chrome. */
  embedded?: boolean;
}

export function CsvImportPanel({ onImported, embedded }: CsvImportPanelProps) {
  const { t } = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportContactsResult | null>(null);

  const handleFile = async (selected: File) => {
    setError("");
    setResult(null);
    try {
      const parsed = parseCsv(await selected.text());
      if (!parsed.headers.includes("phone")) {
        setError(t.contacts.importNoPhoneColumn);
        setFile(null);
        return;
      }
      if (parsed.rows.length === 0) {
        setError(t.contacts.importEmpty);
        setFile(null);
        return;
      }
      setFile(selected);
      setRowCount(parsed.rows.length);
    } catch {
      setError(t.contacts.importEmpty);
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const imported = await api.upload<ImportContactsResult>("/contacts/import", form);
      setResult(imported);
      setFile(null);
      onImported?.(imported, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={embedded ? "space-y-3" : "space-y-4 p-4"}>
      {!embedded && <h2 className="font-semibold">{t.contacts.importTitle}</h2>}

      <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <p>{t.contacts.importHint}</p>
        <p className="font-mono text-[11px]">{t.contacts.importExample}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) handleFile(selected);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={importing}>
          <FileUp className="size-4" />
          {t.contacts.selectFile}
        </Button>
        {file && (
          <span className="truncate text-xs text-muted-foreground">
            {file.name} · {rowCount} {t.contacts.importRows}
          </span>
        )}
      </div>

      {file && (
        <Button onClick={handleImport} disabled={importing} className="w-full">
          {importing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t.contacts.importing}
            </>
          ) : (
            <>
              <Upload className="size-4" />
              {t.contacts.import}
            </>
          )}
        </Button>
      )}

      {error && <InlineNotice variant="error">{error}</InlineNotice>}

      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t.contacts.imported, value: result.imported, accent: "text-emerald-600 dark:text-emerald-400" },
              { label: t.contacts.updatedCount, value: result.updated, accent: "" },
              { label: t.contacts.skipped, value: result.skipped.length, accent: result.skipped.length ? "text-amber-600 dark:text-amber-400" : "" },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-lg border p-2 text-center">
                <p className={`text-lg font-semibold ${accent}`}>{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {result.skipped.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
              {result.skipped.map((skip) => (
                <p key={skip.row} className="text-[11px] text-muted-foreground">
                  {t.contacts.skippedRow} {skip.row}: {skip.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
