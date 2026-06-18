"use client";

import React, { useState, useEffect, useCallback, useContext, createContext, useRef } from "react";
import { useRouter } from "next/navigation";
import { visitsApi, appointmentsApi, treatmentsApi, patientsApi, ApiError } from "@/api";
import { useToast } from "@/context/toast-context";
import { useDebounce } from "@/hooks/use-debounce";
import type {
  Visit, VisitItem, Payment, Attachment, HistoryVisit, Treatment, NewItemState,
} from "@/components/visits/types";
import type { ClinicalPhoto } from "@/types";
import type { TreatmentDecision } from "@/api/treatments";
import type { ChartData } from "@/components/ui/ToothChart";
import type { Prescription } from "@/types";

type TabKey = "items" | "payments" | "files" | "prescriptions" | "treatmentPlan" | "chart";

export interface VisitContextValue {
  // Data
  visit: Visit | null;
  items: VisitItem[];
  payments: Payment[];
  attachments: Attachment[];
  photos: ClinicalPhoto[];
  prescriptions: Prescription[];
  history: HistoryVisit[];
  treatments: Treatment[];

  // UI state
  tab: TabKey;
  setTab: React.Dispatch<React.SetStateAction<TabKey>>;
  loading: boolean;
  pageError: string;
  setPageError: React.Dispatch<React.SetStateAction<string>>;
  markingApptDone: boolean;
  appointmentStatus: string | null;
  completingVisit: boolean;
  completeCheckDecisions: TreatmentDecision[] | null;
  setCompleteCheckDecisions: React.Dispatch<React.SetStateAction<TreatmentDecision[] | null>>;
  currentChartData: ChartData;

  // Notes
  editingNotes: boolean;
  setEditingNotes: React.Dispatch<React.SetStateAction<boolean>>;
  notesForm: { chiefComplaint: string; doctorNotes: string; diagnosis: string };
  setNotesForm: React.Dispatch<React.SetStateAction<{ chiefComplaint: string; doctorNotes: string; diagnosis: string }>>;
  savingNotes: boolean;
  notesAutoSaved: boolean;

  // Recall
  editingRecall: boolean;
  setEditingRecall: React.Dispatch<React.SetStateAction<boolean>>;
  recallForm: { recallDate: string; recallNotes: string };
  setRecallForm: React.Dispatch<React.SetStateAction<{ recallDate: string; recallNotes: string }>>;
  savingRecall: boolean;

  // Payment modal
  showPayModal: boolean;
  setShowPayModal: React.Dispatch<React.SetStateAction<boolean>>;
  payForm: { amount: string; paymentMethod: string; referenceNumber: string; notes: string };
  setPayForm: React.Dispatch<React.SetStateAction<{ amount: string; paymentMethod: string; referenceNumber: string; notes: string }>>;
  payError: string;
  setPayError: React.Dispatch<React.SetStateAction<string>>;
  paySubmitting: boolean;

  // Misc
  prefillItem: NewItemState | null;
  setPrefillItem: React.Dispatch<React.SetStateAction<NewItemState | null>>;
  confirmComplete: { due: number; mode: "page" | "modal" } | null;
  setConfirmComplete: React.Dispatch<React.SetStateAction<{ due: number; mode: "page" | "modal" } | null>>;

  // Chart <-> bill suggestions
  chartBillSuggestion: { treatmentId: string; description: string; toothNumber: string } | null;
  setChartBillSuggestion: React.Dispatch<React.SetStateAction<{ treatmentId: string; description: string; toothNumber: string } | null>>;
  billChartSuggestion: string[] | null;
  setBillChartSuggestion: React.Dispatch<React.SetStateAction<string[] | null>>;
  chartHighlightTeeth: string[];
  setChartHighlightTeeth: React.Dispatch<React.SetStateAction<string[]>>;

  // Navigation helper
  navigateToBookFollowup: () => void;

  // Handlers
  fetchVisit: () => Promise<void>;
  handleSaveNotes: (e: React.FormEvent) => Promise<void>;
  handleSaveRecall: (e: React.FormEvent) => Promise<void>;
  handleClearRecall: () => Promise<void>;
  handleAddPayment: (allowOverpayment?: boolean) => Promise<void>;
  handleCompleteVisit: () => Promise<void>;
  handleModalComplete: () => Promise<void>;
  doForceComplete: (mode: "page" | "modal") => Promise<void>;
  handleMarkAppointmentDone: () => Promise<void>;
  handleChartSuggestBill: (treatmentId: string, description: string, toothNumber: string) => void;
  handleBillSuggestChart: (toothNumbers: string[]) => void;
  handleLinkTreatments: (plans: Treatment[]) => Promise<void>;
  handleLinkTreatmentsOnly: (plans: Treatment[]) => Promise<void>;
  handleAddToBill: (item: NewItemState) => void;
}

const VisitContext = createContext<VisitContextValue | null>(null);

export function useVisit(): VisitContextValue {
  const ctx = useContext(VisitContext);
  if (!ctx) throw new Error("useVisit must be used inside <VisitProvider>");
  return ctx;
}

interface VisitProviderProps {
  visitId: string;
  children: React.ReactNode;
}

function inferConditionFromTreatment(description: string, procedure?: string | null): string {
  const text = `${description} ${procedure ?? ""}`.toLowerCase();
  if (/root.?canal|rct|endodont/i.test(text)) return "ROOT_CANAL";
  if (/crown|ceramic|porcelain|zirconia|pfm/i.test(text)) return "CROWN";
  if (/implant/i.test(text)) return "IMPLANT";
  if (/bridge/i.test(text)) return "BRIDGE";
  if (/extract|remov|pull|avuls/i.test(text)) return "MISSING";
  if (/fractur|crack|chip/i.test(text)) return "FRACTURED";
  if (/filling|composite|amalgam|restoration/i.test(text)) return "FILLING";
  return "WATCH";
}

export function VisitProvider({ visitId, children }: VisitProviderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [items, setItems] = useState<VisitItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [photos, setPhotos] = useState<ClinicalPhoto[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  const [tab, setTab] = useState<TabKey>("items");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [markingApptDone, setMarkingApptDone] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null);
  const [completingVisit, setCompletingVisit] = useState(false);
  const [completeCheckDecisions, setCompleteCheckDecisions] = useState<TreatmentDecision[] | null>(null);
  const [currentChartData, setCurrentChartData] = useState<ChartData>({});

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesForm, setNotesForm] = useState({ chiefComplaint: "", doctorNotes: "", diagnosis: "" });
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesAutoSaved, setNotesAutoSaved] = useState(false);
  const notesAutoSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedNotesForm = useDebounce(notesForm, 1500);
  const notesInitialized = useRef(false);

  const [editingRecall, setEditingRecall] = useState(false);
  const [recallForm, setRecallForm] = useState({ recallDate: "", recallNotes: "" });
  const [savingRecall, setSavingRecall] = useState(false);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
  const [payError, setPayError] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [prefillItem, setPrefillItem] = useState<NewItemState | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<{ due: number; mode: "page" | "modal" } | null>(null);

  const [chartBillSuggestion, setChartBillSuggestion] = useState<{
    treatmentId: string;
    description: string;
    toothNumber: string;
  } | null>(null);

  const [billChartSuggestion, setBillChartSuggestion] = useState<string[] | null>(null);
  const [chartHighlightTeeth, setChartHighlightTeeth] = useState<string[]>([]);

  const fetchVisit = useCallback(async () => {
    setLoading(true);
    try {
      const data = await visitsApi.get(visitId);
      setVisit(data.visit);
      setItems(data.items || []);
      setPayments(data.payments || []);
      setAttachments(data.attachments || []);
      if (data.visit?.appointmentId) {
        appointmentsApi.get(data.visit.appointmentId)
          .then((d) => setAppointmentStatus(d.appointment?.status ?? null))
          .catch(() => setAppointmentStatus(null));
      } else {
        setAppointmentStatus(null);
      }
      treatmentsApi.forVisit.list(visitId).then((d) => setTreatments(d.treatments ?? [])).catch(() => {});
      visitsApi.prescriptions.list(visitId).then((d) => setPrescriptions(d.prescriptions ?? [])).catch(() => {});
      visitsApi.photos.list(visitId).then((d) => setPhotos(d.photos ?? [])).catch(() => {});
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : `Failed to load visit`);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => { fetchVisit(); }, [fetchVisit]);

  useEffect(() => {
    if (visit?.patientId) {
      visitsApi.list({ patientId: visit.patientId })
        .then((d) => setHistory((d.visits ?? []).filter((v: HistoryVisit) => v.id !== visitId)))
        .catch(() => {});
    }
  }, [visit?.patientId, visitId]);

  // Autosave notes 1.5s after user stops typing (only while in edit mode)
  useEffect(() => {
    if (!editingNotes || !visit) return;
    if (!notesInitialized.current) {
      // Skip the first fire after entering edit mode (value just synced from visit)
      notesInitialized.current = true;
      return;
    }
    visitsApi.update(visitId, {
      chiefComplaint: debouncedNotesForm.chiefComplaint || null,
      doctorNotes: debouncedNotesForm.doctorNotes || null,
      diagnosis: debouncedNotesForm.diagnosis || null,
    }).then(() => {
      setNotesAutoSaved(true);
      if (notesAutoSavedTimer.current) clearTimeout(notesAutoSavedTimer.current);
      notesAutoSavedTimer.current = setTimeout(() => setNotesAutoSaved(false), 2000);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNotesForm]);

  // Reset initialized flag when edit mode is toggled
  useEffect(() => {
    if (!editingNotes) {
      notesInitialized.current = false;
      setNotesAutoSaved(false);
    }
  }, [editingNotes]);

  async function handleSaveNotes(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotes(true);
    setPageError("");
    try {
      await visitsApi.update(visitId, { chiefComplaint: notesForm.chiefComplaint || null, doctorNotes: notesForm.doctorNotes || null, diagnosis: notesForm.diagnosis || null });
      await fetchVisit();
      setEditingNotes(false);
      toast.success("Notes saved");
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to save notes");
    } finally { setSavingNotes(false); }
  }

  async function handleSaveRecall(e: React.FormEvent) {
    e.preventDefault();
    setSavingRecall(true);
    setPageError("");
    try {
      await visitsApi.update(visitId, { recallDate: recallForm.recallDate || null, recallNotes: recallForm.recallNotes || null });
      await fetchVisit();
      setEditingRecall(false);
      toast.success("Recall date saved");
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to save recall");
    } finally { setSavingRecall(false); }
  }

  async function handleClearRecall() {
    setSavingRecall(true);
    await visitsApi.update(visitId, { recallDate: null, recallNotes: null }).catch(() => {});
    await fetchVisit();
    setEditingRecall(false);
    setSavingRecall(false);
  }

  async function handleAddPayment(allowOverpayment = false) {
    if (!visit) return;
    setPayError("");
    setPaySubmitting(true);
    try {
      await visitsApi.payments.add(visitId, {
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod as "CASH" | "CARD" | "UPI" | "BANK_TRANSFER",
        referenceNumber: payForm.referenceNumber || undefined,
        notes: payForm.notes || undefined,
        allowOverpayment,
      });
      setShowPayModal(false);
      setPayForm({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
      toast.success("Payment recorded");
      await fetchVisit();
    } catch (e) {
      setPayError(e instanceof ApiError ? e.message : "Payment failed");
    } finally { setPaySubmitting(false); }
  }

  async function handleCompleteVisit() {
    if (!visit) return;
    setCompletingVisit(true);
    setPageError("");
    try {
      const check = await treatmentsApi.getCompleteCheck(visitId);
      if (check.needsAttention) {
        const { toothData } = await patientsApi.getToothChart(visit.patientId);
        setCurrentChartData((toothData as ChartData) ?? {});
        setCompleteCheckDecisions(check.treatments);
        setCompletingVisit(false);
        return;
      }

      const due = visit.totalAmount - visit.paidAmount;
      if (due > 0) {
        setCompletingVisit(false);
        setConfirmComplete({ due, mode: "page" });
        return;
      }

      await visitsApi.update(visitId, { status: "COMPLETED" });
      toast.success("Visit marked as complete");
      await fetchVisit();
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to complete visit");
    } finally { setCompletingVisit(false); }
  }

  async function handleModalComplete() {
    if (!visit) return;
    const due = visit.totalAmount - visit.paidAmount;
    if (due > 0) {
      setConfirmComplete({ due, mode: "modal" });
      return;
    }
    await visitsApi.update(visitId, { status: "COMPLETED" });
    toast.success("Visit marked as complete");
    setCompleteCheckDecisions(null);
    await fetchVisit();
  }

  async function doForceComplete(mode: "page" | "modal") {
    try {
      await visitsApi.update(visitId, { status: "COMPLETED" });
      toast.success("Visit marked as complete");
      if (mode === "modal") setCompleteCheckDecisions(null);
      await fetchVisit();
    } catch (e) {
      setPageError(e instanceof ApiError ? e.message : "Failed to complete visit");
    }
  }

  async function handleMarkAppointmentDone() {
    if (!visit?.appointmentId) return;
    setMarkingApptDone(true);
    try {
      await appointmentsApi.updateStatus(visit.appointmentId, "COMPLETED");
      setAppointmentStatus("COMPLETED");
      toast.success("Appointment marked as done");
      await fetchVisit();
    } finally { setMarkingApptDone(false); }
  }

  function handleChartSuggestBill(treatmentId: string, description: string, toothNumber: string) {
    setChartBillSuggestion({ treatmentId, description, toothNumber });
  }

  function handleBillSuggestChart(toothNumbers: string[]) {
    setBillChartSuggestion(toothNumbers);
  }

  async function handleLinkTreatments(plans: Treatment[]) {
    for (const plan of plans) {
      await treatmentsApi.forVisit.link(visitId, { treatmentId: plan.id });

      const alreadyBilledHere = items.some((i) => i.linkedTreatmentId === plan.id);
      const outstanding = Math.max(0, plan.cost - (plan.billedAmount ?? 0));
      if (!alreadyBilledHere && outstanding > 0) {
        const firstTooth = plan.toothNumbers?.split(",")[0]?.trim() ?? "";
        await visitsApi.items.add(visitId, {
          itemName: plan.description,
          category: "TREATMENT",
          toothNumber: firstTooth || undefined,
          quantity: 1,
          unitPrice: outstanding,
          notes: "",
          linkedTreatmentId: plan.id,
        });
      }

      if (plan.status === "IN_PROGRESS" && plan.toothNumbers) {
        const teeth = plan.toothNumbers.split(",").map((t) => t.trim()).filter(Boolean);
        if (teeth.length > 0) {
          const inferredCondition = inferConditionFromTreatment(plan.description, plan.procedure);
          const { toothData } = await patientsApi.getToothChart(visit!.patientId);
          const updatedChart = { ...(toothData as Record<string, { condition: string }> ?? {}) };
          for (const tooth of teeth) updatedChart[tooth] = { condition: inferredCondition };
          await patientsApi.saveToothChart(
            visit!.patientId,
            updatedChart as Record<string, unknown>,
            visitId,
            "treatment_start",
            plan.id,
          );
        }
      }
    }
    await fetchVisit();
  }

  async function handleLinkTreatmentsOnly(plans: Treatment[]) {
    for (const plan of plans) {
      await treatmentsApi.forVisit.link(visitId, { treatmentId: plan.id });
    }
    await fetchVisit();
  }

  function handleAddToBill(item: NewItemState) {
    setPrefillItem(item);
    setTab("items");
  }

  const navigateToBookFollowup = useCallback(() => {
    if (!visit) return;
    router.push(`/dashboard/appointments/new?patientId=${visit.patientId}&doctorId=${visit.doctorId}&type=FOLLOWUP`);
  }, [router, visit]);

  const value: VisitContextValue = {
    visit,
    items,
    payments,
    attachments,
    photos,
    prescriptions,
    history,
    treatments,
    tab,
    setTab,
    loading,
    pageError,
    setPageError,
    markingApptDone,
    appointmentStatus,
    completingVisit,
    completeCheckDecisions,
    setCompleteCheckDecisions,
    currentChartData,
    editingNotes,
    setEditingNotes,
    notesForm,
    setNotesForm,
    savingNotes,
    notesAutoSaved,
    editingRecall,
    setEditingRecall,
    recallForm,
    setRecallForm,
    savingRecall,
    showPayModal,
    setShowPayModal,
    payForm,
    setPayForm,
    payError,
    setPayError,
    paySubmitting,
    prefillItem,
    setPrefillItem,
    confirmComplete,
    setConfirmComplete,
    chartBillSuggestion,
    setChartBillSuggestion,
    billChartSuggestion,
    setBillChartSuggestion,
    chartHighlightTeeth,
    setChartHighlightTeeth,
    navigateToBookFollowup,
    fetchVisit,
    handleSaveNotes,
    handleSaveRecall,
    handleClearRecall,
    handleAddPayment,
    handleCompleteVisit,
    handleModalComplete,
    doForceComplete,
    handleMarkAppointmentDone,
    handleChartSuggestBill,
    handleBillSuggestChart,
    handleLinkTreatments,
    handleLinkTreatmentsOnly,
    handleAddToBill,
  };

  return <VisitContext.Provider value={value}>{children}</VisitContext.Provider>;
}
