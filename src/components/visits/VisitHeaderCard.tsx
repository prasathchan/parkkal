"use client";

import Link from "next/link";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { STATUS_COLORS } from "./types";
import type { Visit } from "./types";

interface NotesForm {
  chiefComplaint: string;
  doctorNotes: string;
  diagnosis: string;
}

interface RecallForm {
  recallDate: string;
  recallNotes: string;
}

interface Props {
  visitId: string;
  visit: Visit;
  due: number;
  editingNotes: boolean;
  notesForm: NotesForm;
  savingNotes: boolean;
  editingRecall: boolean;
  recallForm: RecallForm;
  savingRecall: boolean;
  completingVisit: boolean;
  onEditNotes: () => void;
  onNotesChange: (form: NotesForm) => void;
  onSaveNotes: (e: React.FormEvent) => void;
  onCancelNotes: () => void;
  onEditRecall: () => void;
  onRecallChange: (form: RecallForm) => void;
  onSaveRecall: (e: React.FormEvent) => void;
  onCancelRecall: () => void;
  onClearRecall: () => void;
  onCompleteVisit: () => void;
  onBookFollowup: () => void;
  onAddPayment: () => void;
}

export function VisitHeaderCard({
  visitId, visit, due,
  editingNotes, notesForm, savingNotes,
  editingRecall, recallForm, savingRecall,
  completingVisit,
  onEditNotes, onNotesChange, onSaveNotes, onCancelNotes,
  onEditRecall, onRecallChange, onSaveRecall, onCancelRecall, onClearRecall,
  onCompleteVisit, onBookFollowup, onAddPayment,
}: Props) {
  return (
    <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-pk-text font-mono">{visit.visitCode}</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[visit.status]}`}>
              {visit.status}
            </span>
            {visit.status !== "CANCELLED" && !editingNotes && (
              <button
                onClick={onEditNotes}
                className="text-xs text-pk-text-muted hover:text-pk-teal-600 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>
            )}
          </div>
          <p className="text-sm text-pk-text-secondary">
            <span className="font-medium">{visit.patientName}</span>
            <span className="text-pk-text-muted ml-1">({visit.patientCode})</span>
            <span className="text-pk-text-muted mx-2">·</span>
            {formatDoctorName(visit.doctorName)}
            <span className="text-pk-text-muted mx-2">·</span>
            {visit.visitDate}
          </p>

          {/* Clinical notes */}
          {!editingNotes ? (
            <div className="mt-1 space-y-0.5">
              {visit.chiefComplaint && <p className="text-sm text-pk-text-muted italic">Chief complaint: {visit.chiefComplaint}</p>}
              {visit.diagnosis && <p className="text-sm text-pk-text-secondary"><span className="font-medium text-pk-text-secondary">Diagnosis:</span> {visit.diagnosis}</p>}
              {visit.doctorNotes && <p className="text-sm text-pk-text-muted">Notes: {visit.doctorNotes}</p>}
            </div>
          ) : (
            <form onSubmit={onSaveNotes} className="mt-2 space-y-2 bg-pk-surface-raised rounded-pk-sm p-3 border border-pk-border">
              <div>
                <label className="block text-xs font-medium text-pk-text-secondary mb-1">Chief Complaint</label>
                <input type="text" value={notesForm.chiefComplaint} onChange={e => onNotesChange({ ...notesForm, chiefComplaint: e.target.value })} className="w-full px-2.5 py-1.5 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-pk-text-secondary mb-1">Diagnosis</label>
                <input type="text" value={notesForm.diagnosis} onChange={e => onNotesChange({ ...notesForm, diagnosis: e.target.value })} className="w-full px-2.5 py-1.5 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" placeholder="Enter diagnosis..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-pk-text-secondary mb-1">Doctor Notes</label>
                <textarea value={notesForm.doctorNotes} onChange={e => onNotesChange({ ...notesForm, doctorNotes: e.target.value })} rows={2} className="w-full px-2.5 py-1.5 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingNotes} className="text-xs bg-pk-teal-600 text-white px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 disabled:opacity-50">{savingNotes ? "Saving..." : "Save"}</button>
                <button type="button" onClick={onCancelNotes} className="text-xs border border-pk-border-strong text-pk-text-secondary px-3 py-1.5 rounded-pk-sm hover:bg-pk-surface-sunken">Cancel</button>
              </div>
            </form>
          )}

          {/* Recall */}
          <div className="mt-3 pt-3 border-t border-pk-border">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-pk-text-muted uppercase tracking-wide">Recall</span>
              {visit.status !== "CANCELLED" && !editingRecall && (
                <button onClick={onEditRecall} className="text-xs text-pk-text-muted hover:text-pk-teal-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {visit.recallDate ? "Edit" : "Set recall"}
                </button>
              )}
            </div>
            {!editingRecall ? (
              visit.recallDate ? (
                <div className="text-sm text-pk-text-secondary">
                  <span className="font-medium">{visit.recallDate}</span>
                  {visit.recallNotes && <span className="text-pk-text-muted ml-2">— {visit.recallNotes}</span>}
                </div>
              ) : (
                <p className="text-sm text-pk-text-muted italic">No recall scheduled</p>
              )
            ) : (
              <form onSubmit={onSaveRecall} className="space-y-2 bg-pk-surface-raised rounded-pk-sm p-3 border border-pk-border">
                <div className="flex gap-3 flex-wrap">
                  <div className="flex-1 min-w-36">
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Recall Date</label>
                    <input type="date" value={recallForm.recallDate} onChange={e => onRecallChange({ ...recallForm, recallDate: e.target.value })} className="w-full px-2.5 py-1.5 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div className="flex-[2] min-w-48">
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Notes (optional)</label>
                    <input type="text" value={recallForm.recallNotes} onChange={e => onRecallChange({ ...recallForm, recallNotes: e.target.value })} placeholder="e.g. 6-month checkup" className="w-full px-2.5 py-1.5 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={savingRecall} className="text-xs bg-pk-teal-600 text-white px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 disabled:opacity-50">{savingRecall ? "Saving..." : "Save"}</button>
                  <button type="button" onClick={onCancelRecall} className="text-xs border border-pk-border-strong text-pk-text-secondary px-3 py-1.5 rounded-pk-sm hover:bg-pk-surface-sunken">Cancel</button>
                  {visit.recallDate && (
                    <button type="button" onClick={onClearRecall} disabled={savingRecall} className="text-xs text-pk-danger-text hover:text-pk-danger-text px-2 py-1.5 disabled:opacity-50">Clear recall</button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right side — financials + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-xs text-pk-text-muted">Total</p>
                <p className="font-semibold text-pk-text">{formatCurrency(visit.totalAmount)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-pk-text-muted">Paid</p>
                <p className="font-semibold text-pk-success-text">{formatCurrency(visit.paidAmount)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-pk-text-muted">Due</p>
                <p className={`font-semibold ${due > 0 ? "text-pk-danger-text" : "text-pk-text-muted"}`}>{formatCurrency(due)}</p>
              </div>
            </div>
          </div>
          <Link href={`/print/visits/${visitId}`} target="_blank" className="inline-flex items-center gap-2 border border-pk-border px-3 py-2 rounded-pk-sm text-sm hover:bg-pk-surface-raised transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </Link>
          {visit.status === "OPEN" && (
            <button onClick={onCompleteVisit} disabled={completingVisit} className="inline-flex items-center gap-2 bg-pk-neutral-600 text-white px-3 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-neutral-700 disabled:opacity-40 transition">
              {completingVisit ? "Completing..." : "Complete Visit"}
            </button>
          )}
          {visit.status !== "CANCELLED" && (
            <button onClick={onBookFollowup} className="inline-flex items-center gap-2 border border-pk-border text-pk-text-secondary px-3 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-surface-raised transition">
              Book Follow-up
            </button>
          )}
          <button onClick={onAddPayment} disabled={visit.status === "CANCELLED" || due <= 0} className="inline-flex items-center gap-2 bg-pk-success text-white px-3 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-success disabled:opacity-40 transition">
            Add Payment
          </button>
        </div>
      </div>
    </div>
  );
}
