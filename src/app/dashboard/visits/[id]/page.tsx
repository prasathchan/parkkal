"use client";

import { useParams } from "next/navigation";
import { VisitProvider, useVisit } from "@/context/visit-context";
import Link from "next/link";
import { Header } from "@/components/header";
import { VisitHeaderCard } from "@/components/visits/VisitHeaderCard";
import { PaymentModal } from "@/components/visits/PaymentModal";
import { VisitItemsTab } from "@/components/visits/VisitItemsTab";
import { VisitPaymentsTab } from "@/components/visits/VisitPaymentsTab";
import { VisitFilesTab } from "@/components/visits/VisitFilesTab";
import { VisitTreatmentPlanTab } from "@/components/visits/VisitTreatmentPlanTab";
import { VisitToothChartTab } from "@/components/visits/VisitToothChartTab";
import { VisitPrescriptionsTab } from "@/components/visits/VisitPrescriptionsTab";
import { LinkSuggestBar } from "@/components/visits/LinkSuggestBar";
import { CompleteVisitModal } from "@/components/visits/CompleteVisitModal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { NewItemState } from "@/components/visits/types";
import { SkeletonDetailPage } from "@/components/ui/skeleton";

type TabKey = "items" | "payments" | "files" | "prescriptions" | "treatmentPlan" | "chart";

function VisitPageContent() {
  const {
    visit, items, payments, attachments, photos, prescriptions, history, treatments,
    tab, setTab, loading, pageError, setPageError,
    markingApptDone, appointmentStatus, completingVisit,
    completeCheckDecisions, setCompleteCheckDecisions, currentChartData,
    editingNotes, setEditingNotes, notesForm, setNotesForm, savingNotes, notesAutoSaved,
    editingRecall, setEditingRecall, recallForm, setRecallForm, savingRecall,
    showPayModal, setShowPayModal, payForm, setPayForm, payError, paySubmitting,
    prefillItem, setPrefillItem, confirmComplete, setConfirmComplete,
    chartBillSuggestion, setChartBillSuggestion,
    billChartSuggestion, setBillChartSuggestion, chartHighlightTeeth, setChartHighlightTeeth,
    navigateToBookFollowup, fetchVisit,
    handleSaveNotes, handleSaveRecall, handleClearRecall,
    handleAddPayment, handleCompleteVisit, handleModalComplete, doForceComplete,
    handleMarkAppointmentDone, handleChartSuggestBill, handleBillSuggestChart,
    handleLinkTreatments, handleLinkTreatmentsOnly, handleAddToBill,
  } = useVisit();

  const { id } = useParams<{ id: string }>();

  if (loading) return <SkeletonDetailPage />;
  if (!visit) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-pk-text-muted">{pageError || "Visit not found."}</p>
        <Link href="/dashboard/visits" className="text-pk-teal-600 hover:underline text-sm">Back to Visits</Link>
      </div>
    );
  }

  const due = visit.totalAmount - visit.paidAmount;

  return (
    <div className="flex-1 flex flex-col">
      <Header title={visit.visitCode} breadcrumb={[{ label: "Dashboard" }, { label: "Visits", href: "/dashboard/visits" }, { label: visit.visitCode }]} />
      <main id="main-content" className="flex-1 p-6 space-y-5">
        {pageError && (
          <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text rounded-pk-sm px-4 py-3 text-sm flex items-center justify-between">
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} aria-label="Dismiss error" className="ml-4 text-pk-danger-text hover:text-pk-danger-text font-bold leading-none">&times;</button>
          </div>
        )}

        {visit.appointmentId && appointmentStatus && appointmentStatus !== "COMPLETED" && visit.status !== "COMPLETED" && visit.status !== "CANCELLED" && (
          <div className="bg-pk-teal-50 border border-pk-teal-200 rounded-pk-lg px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-pk-teal-800">
              <span>📅</span><span>This visit is linked to a scheduled appointment.</span>
            </div>
            <button onClick={handleMarkAppointmentDone} disabled={markingApptDone} className="text-xs bg-pk-teal-600 text-white px-3 py-1.5 rounded-pk-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition">
              {markingApptDone ? "Marking..." : "Mark Appointment Done"}
            </button>
          </div>
        )}
        {visit.appointmentId && (appointmentStatus === "COMPLETED" || visit.status === "COMPLETED") && (
          <div className="bg-pk-success-fill border border-pk-success-border rounded-pk-lg px-5 py-3 flex items-center gap-2 text-sm text-pk-success-text">
            <span>✅</span><span>Appointment marked as completed.</span>
          </div>
        )}

        {visit.status === "OPEN" && (
          <LinkSuggestBar
            visitId={id}
            patientId={visit.patientId}
            alreadyLinkedIds={new Set(treatments.map((t) => t.id))}
            onLink={handleLinkTreatments}
            onLinkOnly={handleLinkTreatmentsOnly}
          />
        )}

        <VisitHeaderCard
          visitId={id} visit={visit} due={due}
          editingNotes={editingNotes} notesForm={notesForm} savingNotes={savingNotes} notesAutoSaved={notesAutoSaved}
          editingRecall={editingRecall} recallForm={recallForm} savingRecall={savingRecall}
          completingVisit={completingVisit}
          onEditNotes={() => { setNotesForm({ chiefComplaint: visit.chiefComplaint || "", doctorNotes: visit.doctorNotes || "", diagnosis: visit.diagnosis || "" }); setEditingNotes(true); }}
          onNotesChange={setNotesForm}
          onSaveNotes={handleSaveNotes}
          onCancelNotes={() => setEditingNotes(false)}
          onEditRecall={() => { setRecallForm({ recallDate: visit.recallDate || "", recallNotes: visit.recallNotes || "" }); setEditingRecall(true); }}
          onRecallChange={setRecallForm}
          onSaveRecall={handleSaveRecall}
          onCancelRecall={() => setEditingRecall(false)}
          onClearRecall={handleClearRecall}
          onCompleteVisit={handleCompleteVisit}
          onBookFollowup={navigateToBookFollowup}
          onAddPayment={() => setShowPayModal(true)}
        />

        <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1">
          {/* Mobile: tab select */}
          <div className="md:hidden border-b border-pk-border px-4 py-2">
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value as TabKey)}
              className="w-full text-sm rounded-pk-sm border border-pk-border bg-pk-surface px-3 py-2 text-pk-text focus:outline-none focus:ring-1 focus:ring-pk-teal-500"
            >
              {(["items", "payments", "files", "prescriptions", "treatmentPlan", "chart"] as TabKey[]).map((t) => (
                <option key={t} value={t}>
                  {t === "items" ? "Items"
                    : t === "files" ? `Files${(photos.length + attachments.length) > 0 ? ` (${photos.length + attachments.length})` : ""}`
                    : t === "treatmentPlan" ? "Treatment Plan"
                    : t === "chart" ? "Dental Chart"
                    : t === "prescriptions" ? "Prescriptions"
                    : t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {/* Desktop: tab buttons */}
          <div className="hidden md:flex border-b border-pk-border px-6 gap-1 overflow-x-auto rounded-t-pk-lg overflow-hidden">
            {(["items", "payments", "files", "prescriptions", "treatmentPlan", "chart"] as TabKey[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? "border-pk-teal-600 text-pk-teal-600" : "border-transparent text-pk-text-muted hover:text-pk-text-secondary"}`}>
                {t === "items" ? "Items"
                  : t === "treatmentPlan" ? "Treatment Plan"
                  : t === "chart" ? "Dental Chart"
                  : t === "prescriptions" ? "Prescriptions"
                  : t === "files"
                    ? (<span className="flex items-center gap-1">Files{(photos.length + attachments.length) > 0 && <span className="text-xs bg-pk-teal-100 text-pk-teal-700 px-1.5 rounded-full">{photos.length + attachments.length}</span>}</span>)
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="p-6">
            {/* Gap 4 — chart → bill suggestion banner */}
            {tab === "chart" && chartBillSuggestion && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-pk-lg border border-pk-teal-200 bg-teal-50 px-4 py-3">
                <p className="text-sm text-pk-teal-700 font-medium">
                  <span className="font-semibold">{chartBillSuggestion.description}</span>
                  {" · Tooth "}{chartBillSuggestion.toothNumber}
                  {" — Add to bill?"}
                </p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    className="bg-pk-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 transition"
                    onClick={() => {
                      const tx = treatments.find((t) => t.id === chartBillSuggestion.treatmentId);
                      if (tx) {
                        setPrefillItem({
                          itemName: tx.description,
                          category: "TREATMENT",
                          toothNumber: chartBillSuggestion.toothNumber,
                          quantity: "1",
                          unitPrice: String(Math.max(0, tx.cost - (tx.billedAmount ?? 0))),
                          notes: "",
                          linkedTreatmentId: tx.id,
                        } as NewItemState);
                      }
                      setChartBillSuggestion(null);
                      setTab("items");
                    }}
                  >
                    Add item
                  </button>
                  <button
                    type="button"
                    className="text-xs text-pk-text-muted hover:text-pk-text-secondary transition"
                    onClick={() => setChartBillSuggestion(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Gap 5 — bill → chart suggestion banner */}
            {tab === "items" && billChartSuggestion && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-pk-lg border border-pk-teal-200 bg-teal-50 px-4 py-3">
                <p className="text-sm text-pk-teal-700 font-medium">
                  Update the dental chart for{" "}
                  {billChartSuggestion.length === 1
                    ? `tooth ${billChartSuggestion[0]}`
                    : `teeth ${billChartSuggestion.join(", ")}`}?
                </p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    className="bg-pk-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 transition"
                    onClick={() => {
                      setChartHighlightTeeth(billChartSuggestion);
                      setBillChartSuggestion(null);
                      setTab("chart");
                    }}
                  >
                    Update chart
                  </button>
                  <button
                    type="button"
                    className="text-xs text-pk-text-muted hover:text-pk-text-secondary transition"
                    onClick={() => setBillChartSuggestion(null)}
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}

            {tab === "items" && <VisitItemsTab key={prefillItem ? JSON.stringify(prefillItem) : "items"} visitId={id} visitStatus={visit.status} items={items} treatments={treatments} payments={payments} prefillItem={prefillItem} due={due} history={history} patientName={visit.patientName ?? ""} onRefresh={fetchVisit} onPageError={setPageError} onSuggestChart={handleBillSuggestChart} />}
            {tab === "payments" && <VisitPaymentsTab visit={visit} payments={payments} due={due} onOpenPayModal={() => setShowPayModal(true)} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "files" && <VisitFilesTab visitId={id} visitStatus={visit.status} patientId={visit.patientId} attachments={attachments} photos={photos} treatments={treatments} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "prescriptions" && <VisitPrescriptionsTab visitId={id} visitStatus={visit.status} prescriptions={prescriptions} onRefresh={fetchVisit} onPageError={setPageError} />}
            {tab === "treatmentPlan" && <VisitTreatmentPlanTab visitId={id} visit={visit} treatments={treatments} onRefresh={fetchVisit} onPageError={setPageError} onAddToBill={handleAddToBill} onLinkPlan={async (plan) => { await handleLinkTreatments([plan]); }} />}
            {tab === "chart" && <VisitToothChartTab visitId={id} patientId={visit.patientId} visitStatus={visit.status} items={items} treatments={treatments} onSuggestBill={handleChartSuggestBill} externalHighlightTeeth={chartHighlightTeeth} />}
          </div>
        </div>
      </main>

      {showPayModal && (
        <PaymentModal
          due={due} payForm={payForm} payError={payError} paySubmitting={paySubmitting}
          onChange={setPayForm} onSubmit={handleAddPayment} onClose={() => { setShowPayModal(false); setPageError(""); }}
        />
      )}

      {completeCheckDecisions && visit && (
        <CompleteVisitModal
          visitId={id}
          patientId={visit.patientId}
          decisions={completeCheckDecisions}
          currentChartData={currentChartData}
          onComplete={handleModalComplete}
          onCancel={() => setCompleteCheckDecisions(null)}
        />
      )}

      {confirmComplete && (
        <ConfirmModal
          title="Outstanding balance"
          message={`This visit has ₹${confirmComplete.due.toFixed(2)} outstanding. Mark as complete anyway?`}
          confirmLabel="Mark complete"
          variant="danger"
          onConfirm={() => { const mode = confirmComplete.mode; setConfirmComplete(null); doForceComplete(mode); }}
          onCancel={() => setConfirmComplete(null)}
        />
      )}
    </div>
  );
}

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <VisitProvider visitId={id}>
      <VisitPageContent />
    </VisitProvider>
  );
}
