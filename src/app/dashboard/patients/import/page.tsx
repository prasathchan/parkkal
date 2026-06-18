"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { patientsApi } from "@/api";
import type { ImportPatientRow } from "@/api/patients";

type Step = 1 | 2 | 3;

const TEMPLATE_CSV = [
  "name,phone,email,dateOfBirth,gender,bloodGroup,medicalNotes",
  "Arun Kumar,9876543210,arun@example.com,1985-06-15,MALE,O+,",
  "Priya Sharma,9123456789,priya@example.com,1990-11-22,FEMALE,B+,Diabetic",
].join("\n");

const REQUIRED_COLS = ["name", "phone"];
const OPTIONAL_COLS = ["email", "dateofbirth", "gender", "bloodgroup", "medicalnotes"];
const ALL_COLS = [...REQUIRED_COLS, ...OPTIONAL_COLS];

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "parkkal-patient-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface ParsedRow {
  row: number;
  data: ImportPatientRow;
  errors: string[];
}

function parseCSV(text: string): { rows: ParsedRow[]; headerErrors: string[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], headerErrors: ["CSV must have a header row and at least one data row."] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
  const missingRequired = REQUIRED_COLS.filter((c) => !headers.includes(c));
  if (missingRequired.length > 0) {
    return { rows: [], headerErrors: [`Missing required columns: ${missingRequired.join(", ")}. Download the template for the correct format.`] };
  }

  const unknownCols = headers.filter((h) => !ALL_COLS.includes(h));
  const headerErrors = unknownCols.length > 0
    ? [`Unknown columns (will be ignored): ${unknownCols.join(", ")}`]
    : [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < Math.min(lines.length, 1001); i++) {
    const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const get = (col: string) => vals[headers.indexOf(col)] ?? "";

    const name  = get("name");
    const phone = get("phone");
    const email = get("email");
    const dob   = get("dateofbirth");
    const gender = get("gender").toUpperCase();
    const blood  = get("bloodgroup");
    const notes  = get("medicalnotes");

    const rowErrors: string[] = [];
    if (!name)  rowErrors.push("Name is required");
    if (!phone) rowErrors.push("Phone is required");
    if (phone && !/^\d{6,20}$/.test(phone.replace(/[+\-\s()]/g, ""))) rowErrors.push("Invalid phone number");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push("Invalid email");
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) rowErrors.push("Date of birth must be YYYY-MM-DD");
    if (gender && !["MALE","FEMALE","OTHER",""].includes(gender)) rowErrors.push("Gender must be MALE, FEMALE, or OTHER");

    rows.push({
      row: i + 1,
      data: {
        name,
        phone,
        email:       email || undefined,
        dateOfBirth: dob   || undefined,
        gender:      (["MALE","FEMALE","OTHER"].includes(gender) ? gender : undefined) as "MALE" | "FEMALE" | "OTHER" | undefined,
        bloodGroup:  blood || undefined,
        medicalNotes: notes || undefined,
      },
      errors: rowErrors,
    });
  }

  return { rows, headerErrors };
}

export default function ImportPatientsPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>(1);
  const [csvText, setCsvText]   = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed]     = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [submitting, setSubmitting]   = useState(false);
  const [result, setResult]     = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const { rows, headerErrors } = parseCSV(text);
      setParsed(rows);
      setParseErrors(headerErrors);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const validRows = parsed.filter((r) => r.errors.length === 0).map((r) => r.data);
    if (validRows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await patientsApi.import(validRows);
      setResult(res);
      setStep(3);
    } catch (e) {
      setParseErrors([e instanceof Error ? e.message : "Import failed"]);
    } finally {
      setSubmitting(false);
    }
  }

  const validCount   = parsed.filter((r) => r.errors.length === 0).length;
  const invalidCount = parsed.filter((r) => r.errors.length > 0).length;

  return (
    <div className="min-h-screen bg-pk-surface-raised">
      <Header
        title="Import Patients"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Patients", href: "/dashboard/patients" },
          { label: "Import" },
        ]}
      />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {([1,2,3] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${step >= s ? "bg-pk-teal-600 text-white" : "bg-pk-surface border border-pk-border text-pk-text-muted"}`}>
                {s}
              </div>
              {i < 2 && <div className={`w-16 h-0.5 ${step > s ? "bg-pk-teal-600" : "bg-pk-border"}`} />}
            </div>
          ))}
          <div className="flex ml-4 gap-12 text-xs text-pk-text-muted">
            <span className={step === 1 ? "text-pk-teal-600 font-medium" : ""}>Download template</span>
            <span className={step === 2 ? "text-pk-teal-600 font-medium" : ""}>Upload & preview</span>
            <span className={step === 3 ? "text-pk-teal-600 font-medium" : ""}>Done</span>
          </div>
        </div>

        {/* ── Step 1: Download template ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-pk-surface rounded-pk-lg border border-pk-border p-6 space-y-4">
            <h2 className="text-base font-semibold text-pk-text">Step 1: Download the template</h2>
            <p className="text-sm text-pk-text-secondary">
              Download the CSV template, fill in your patients&apos; data, then upload it in the next step.
              Import supports up to 1,000 patients per batch.
            </p>
            <div className="bg-pk-surface-raised rounded-pk-sm p-4 font-mono text-xs text-pk-text-secondary border border-pk-border overflow-x-auto">
              name,phone,email,dateOfBirth,gender,bloodGroup,medicalNotes
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-pk-text">Column guide:</p>
              <ul className="space-y-1">
                {[
                  ["name", "Required. Full patient name."],
                  ["phone", "Required. Digits, +, spaces, or hyphens."],
                  ["email", "Optional."],
                  ["dateOfBirth", "Optional. Format: YYYY-MM-DD (e.g. 1985-06-15)."],
                  ["gender", "Optional. One of: MALE, FEMALE, OTHER."],
                  ["bloodGroup", "Optional. E.g. O+, AB-."],
                  ["medicalNotes", "Optional. Brief medical history note."],
                ].map(([col, desc]) => (
                  <li key={col} className="flex gap-2">
                    <code className="text-xs font-mono text-pk-teal-700 bg-pk-teal-50 px-1.5 py-0.5 rounded w-32 shrink-0">{col}</code>
                    <span className="text-pk-text-secondary">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-pk-sm border border-pk-border text-pk-text-secondary text-sm font-medium hover:bg-pk-surface-raised transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Template CSV
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-pk-sm bg-pk-teal-600 text-white text-sm font-medium hover:bg-pk-teal-700 transition"
              >
                Next: Upload CSV →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Upload & preview ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-pk-surface rounded-pk-lg border border-pk-border p-6 space-y-4">
              <h2 className="text-base font-semibold text-pk-text">Step 2: Upload your CSV</h2>

              <label
                htmlFor="csv-upload"
                className="flex flex-col items-center justify-center w-full border-2 border-dashed border-pk-border rounded-pk-lg p-8 cursor-pointer hover:border-pk-teal-400 transition"
              >
                <svg className="w-8 h-8 text-pk-text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-pk-text-secondary">
                  {fileName ? fileName : "Click to choose a CSV file"}
                </span>
                <span className="text-xs text-pk-text-muted mt-1">Max 1,000 rows</span>
                <input
                  id="csv-upload"
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleFile}
                />
              </label>

              {parseErrors.length > 0 && (
                <div className="bg-pk-danger-fill border border-pk-danger-border rounded-pk-sm px-4 py-3 text-sm text-pk-danger-text space-y-1">
                  {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>

            {parsed.length > 0 && (
              <div className="bg-pk-surface rounded-pk-lg border border-pk-border overflow-hidden">
                <div className="px-5 py-4 border-b border-pk-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-pk-text">Preview</h3>
                    <p className="text-xs text-pk-text-muted mt-0.5">
                      {validCount} valid · {invalidCount} with errors
                      {parsed.length === 1000 && " · (showing first 1,000)"}
                    </p>
                  </div>
                  {validCount > 0 && (
                    <button
                      onClick={handleImport}
                      disabled={submitting}
                      className="px-4 py-2 rounded-pk-sm bg-pk-teal-600 text-white text-sm font-medium hover:bg-pk-teal-700 transition disabled:opacity-50"
                    >
                      {submitting ? "Importing…" : `Import ${validCount} patients`}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead className="bg-pk-surface-raised sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-pk-text-muted font-medium">Row</th>
                        <th className="px-3 py-2 text-left text-pk-text-muted font-medium">Name</th>
                        <th className="px-3 py-2 text-left text-pk-text-muted font-medium">Phone</th>
                        <th className="px-3 py-2 text-left text-pk-text-muted font-medium">Email</th>
                        <th className="px-3 py-2 text-left text-pk-text-muted font-medium">DOB</th>
                        <th className="px-3 py-2 text-left text-pk-text-muted font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pk-border">
                      {parsed.map((r) => (
                        <tr key={r.row} className={r.errors.length > 0 ? "bg-pk-danger-fill" : "hover:bg-pk-surface-raised"}>
                          <td className="px-3 py-2 font-mono text-pk-text-muted">{r.row}</td>
                          <td className="px-3 py-2 font-medium text-pk-text">{r.data.name || "—"}</td>
                          <td className="px-3 py-2 text-pk-text-secondary">{r.data.phone || "—"}</td>
                          <td className="px-3 py-2 text-pk-text-secondary">{r.data.email || "—"}</td>
                          <td className="px-3 py-2 text-pk-text-secondary">{r.data.dateOfBirth || "—"}</td>
                          <td className="px-3 py-2">
                            {r.errors.length === 0 ? (
                              <span className="text-pk-success-text font-medium">✓ Valid</span>
                            ) : (
                              <span className="text-pk-danger-text" title={r.errors.join("; ")}>
                                ✗ {r.errors[0]}{r.errors.length > 1 ? ` (+${r.errors.length - 1})` : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-pk-sm border border-pk-border text-pk-text-secondary text-sm font-medium hover:bg-pk-surface-raised transition">
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ───────────────────────────────────────────────────── */}
        {step === 3 && result && (
          <div className="bg-pk-surface rounded-pk-lg border border-pk-border p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-pk-success-fill rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-pk-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-pk-text">Import complete</h2>
            <p className="text-sm text-pk-text-secondary">
              <span className="font-semibold text-pk-success-text">{result.imported}</span> patients imported successfully.
              {result.errors.length > 0 && (
                <> <span className="font-semibold text-pk-danger-text">{result.errors.length}</span> rows had errors and were skipped.</>
              )}
            </p>
            {result.errors.length > 0 && (
              <div className="text-left bg-pk-danger-fill border border-pk-danger-border rounded-pk-sm px-4 py-3 text-xs text-pk-danger-text max-h-40 overflow-y-auto">
                {result.errors.map((e) => <p key={e.row}>Row {e.row}: {e.message}</p>)}
              </div>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <Link href="/dashboard/patients" className="px-4 py-2 rounded-pk-sm bg-pk-teal-600 text-white text-sm font-medium hover:bg-pk-teal-700 transition">
                View Patients
              </Link>
              <button
                onClick={() => { setStep(1); setParsed([]); setFileName(""); setResult(null); }}
                className="px-4 py-2 rounded-pk-sm border border-pk-border text-pk-text-secondary text-sm font-medium hover:bg-pk-surface-raised transition"
              >
                Import Another Batch
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
