// Minimal CSV parsing for the contacts import flow (client-side validation
// and phone extraction). Handles quoted fields with commas and escaped quotes.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const lines: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const clean = text.replace(/^﻿/, "");
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) lines.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) lines.push(row);

  const [headerLine, ...rest] = lines;
  return {
    headers: (headerLine ?? []).map((h) => h.trim().toLowerCase()),
    rows: rest,
  };
}

/** Extracts normalized phone digits from the CSV's `phone` column (empty array if the column is missing). */
export function extractPhones(csv: ParsedCsv): string[] {
  const phoneIdx = csv.headers.indexOf("phone");
  if (phoneIdx === -1) return [];
  return csv.rows
    .map((row) => (row[phoneIdx] ?? "").replace(/\D/g, "").replace(/^0+/, ""))
    .filter((digits) => digits.length >= 8 && digits.length <= 15);
}
