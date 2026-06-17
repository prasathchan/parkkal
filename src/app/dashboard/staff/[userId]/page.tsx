"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";
import { parseAddress, serializeAddress, formatAddressDisplay, EMPTY_ADDRESS } from "@/lib/address";
import { orgApi, usersApi, emergencyContactsApi, ApiError } from "@/api";
import type { StaffMember, StaffProfile, Qualification, CredentialDoc, CredentialDocType } from "@/types";

type Member = StaffMember;

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

type SalaryRecord = {
  month: string;
  salaryAmount: number;
  paidAmount: number;
  status: string;
  appointmentCount: number;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-pk-danger-fill text-pk-danger-text",
  DOCTOR: "bg-pk-neutral-100 text-pk-neutral-700",
  NURSE: "bg-pink-100 text-pink-700",
  RECEPTIONIST: "bg-pk-teal-100 text-pk-teal-700",
  ATTENDANT: "bg-pk-warning-fill text-pk-warning-text",
  HELPER: "bg-pk-surface-sunken text-pk-text-secondary",
};

const ROLES = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"] as const;

const SPECIALIZATIONS = [
  "General Dentistry",
  "Orthodontics",
  "Endodontics (Root Canal)",
  "Periodontics (Gum Disease)",
  "Oral and Maxillofacial Surgery",
  "Prosthodontics (Dental Prosthetics)",
  "Pediatric Dentistry",
  "Oral Pathology",
  "Oral Radiology",
  "Dental Public Health",
  "Cosmetic Dentistry",
  "Implantology",
  "Other",
];

const DOC_TYPE_LABELS: Record<CredentialDocType, string> = {
  DEGREE_CERTIFICATE: "Degree Certificate",
  REGISTRATION_CERTIFICATE: "Registration Certificate",
  IDA_CARD: "IDA Membership Card",
  DCI_CARD: "DCI Registration Card",
  GOVERNMENT_ID: "Government ID (Aadhaar / PAN)",
  TRAINING_CERT: "Training / CPD Certificate",
  OTHER: "Other Document",
};

const ALL_DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as CredentialDocType[];

const COMMON_LANGUAGES = ["Tamil", "English", "Hindi", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Urdu"];

// ── Document review row (admin can approve / reject inline) ───────────────────
function DocStatusBadge({ status }: { status: CredentialDoc["status"] }) {
  if (status === "VERIFIED") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-pk-success-fill text-pk-success-text">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      Verified
    </span>
  );
  if (status === "REJECTED") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-pk-danger-fill text-pk-danger-text">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-pk-warning-fill text-pk-warning-text">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      Pending Review
    </span>
  );
}

function DocReviewRow({
  doc, userId, deletingDocId, onDelete, onReviewed,
}: {
  doc: CredentialDoc;
  userId: string;
  deletingDocId: string | null;
  onDelete: (id: string) => void;
  onReviewed: (updated: CredentialDoc) => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  async function handleApprove() {
    setReviewing(true);
    try {
      const data = await orgApi.profile.reviewDoc(userId, doc.id, "approve");
      onReviewed(data.document);
    } catch { /* non-fatal */ } finally { setReviewing(false); }
  }

  async function handleReject() {
    setReviewing(true);
    try {
      const data = await orgApi.profile.reviewDoc(userId, doc.id, "reject", rejectNote);
      onReviewed(data.document);
      setShowRejectForm(false);
      setRejectNote("");
    } catch { /* non-fatal */ } finally { setReviewing(false); }
  }

  return (
    <div className={`p-3 border rounded-pk-sm space-y-2 ${doc.status === "REJECTED" ? "border-pk-danger-border" : doc.status === "VERIFIED" ? "border-pk-success-border" : "border-pk-warning-border bg-pk-warning-fill/10"}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-pk-surface-raised rounded flex items-center justify-center flex-shrink-0 text-pk-text-muted">
          {doc.originalName.toLowerCase().endsWith(".pdf") ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-pk-text truncate">{doc.originalName}</p>
            <DocStatusBadge status={doc.status} />
          </div>
          <p className="text-xs text-pk-text-muted">{DOC_TYPE_LABELS[doc.docType]} · {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</p>
          {doc.status === "REJECTED" && doc.reviewNote && (
            <p className="text-xs text-pk-danger-text mt-0.5">Reason: {doc.reviewNote}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-pk-teal-600 hover:underline font-medium">View</a>
          <button type="button" onClick={() => onDelete(doc.id)} disabled={deletingDocId === doc.id}
            className="text-xs text-pk-danger-text hover:underline disabled:opacity-50">
            {deletingDocId === doc.id ? "…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Admin review actions — only shown for PENDING docs */}
      {doc.status === "PENDING" && (
        <div className="flex items-center gap-2 pt-1 border-t border-pk-warning-border/50">
          <span className="text-xs text-pk-text-muted flex-1">Admin review required</span>
          {!showRejectForm ? (
            <>
              <button type="button" onClick={handleApprove} disabled={reviewing}
                className="text-xs font-medium px-3 py-1 rounded-full bg-pk-success-fill text-pk-success-text hover:opacity-80 disabled:opacity-50 transition">
                {reviewing ? "…" : "✓ Approve"}
              </button>
              <button type="button" onClick={() => setShowRejectForm(true)} disabled={reviewing}
                className="text-xs font-medium px-3 py-1 rounded-full bg-pk-danger-fill text-pk-danger-text hover:opacity-80 transition">
                ✗ Reject
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Rejection reason (optional)…"
                className="flex-1 px-2 py-1 text-xs border border-pk-danger-border rounded-pk-sm focus:outline-none focus:ring-1 focus:ring-pk-danger-border"
              />
              <button type="button" onClick={handleReject} disabled={reviewing}
                className="text-xs font-medium px-3 py-1 rounded-full bg-pk-danger-fill text-pk-danger-text hover:opacity-80 disabled:opacity-50 transition">
                {reviewing ? "…" : "Confirm"}
              </button>
              <button type="button" onClick={() => { setShowRejectForm(false); setRejectNote(""); }}
                className="text-xs text-pk-text-muted hover:text-pk-text">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function emptyQual(): Qualification {
  return { id: crypto.randomUUID(), degree: "", institution: "", year: "", notes: "" };
}

function emptyProfile(): StaffProfile {
  return {
    userId: "",
    bio: null,
    specialization: null,
    yearsExperience: null,
    languages: [],
    qualifications: [],
    idaNumber: null,
    dciNumber: null,
    stateCouncilNumber: null,
    licenseExpiry: null,
    previousEmployer: null,
    documents: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);

  // Personal profile edit
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", dateOfBirth: "", gender: "",
    role: "", salaryType: "FIXED", salaryAmount: "0",
    isActive: true, isDoctor: false,
  });
  const [addressData, setAddressData] = useState<AddressValue>({ ...EMPTY_ADDRESS });
  const [phoneError, setPhoneError] = useState("");

  // Emergency contacts
  const [addingEC, setAddingEC] = useState(false);
  const [ecForm, setEcForm] = useState({ name: "", relationship: "", phone: "", email: "" });
  const [ecSaving, setEcSaving] = useState(false);
  const [ecError, setEcError] = useState("");

  // Account access
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkMode, setLinkMode] = useState<"invite_link" | "no_login_verify">("invite_link");
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [phoneOtpResult, setPhoneOtpResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Professional profile
  const [profile, setProfile] = useState<StaffProfile>(emptyProfile());
  const [profileLoading, setProfileLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<{
    bio: string;
    specialization: string;
    yearsExperience: string;
    languages: string[];
    qualifications: Qualification[];
    idaNumber: string;
    dciNumber: string;
    stateCouncilNumber: string;
    licenseExpiry: string;
    previousEmployer: string;
  }>({
    bio: "", specialization: "", yearsExperience: "", languages: [],
    qualifications: [], idaNumber: "", dciNumber: "",
    stateCouncilNumber: "", licenseExpiry: "", previousEmployer: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Document upload
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState<CredentialDocType>("DEGREE_CERTIFICATE");
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [docError, setDocError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMember();
    fetchSalary();
    fetchEmergencyContacts();
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function fetchMember() {
    try {
      const data = await orgApi.members.list();
      const found: Member | undefined = (data.members ?? []).find((m: Member) => m.userId === userId);
      setMember(found ?? null);
      if (found) {
        setEditForm({
          name: found.name || "", phone: found.phone || "",
          dateOfBirth: found.dateOfBirth || "", gender: found.gender || "",
          role: found.role, salaryType: found.salaryType ?? "FIXED",
          salaryAmount: String(found.salaryAmount ?? 0),
          isActive: found.isActive === 1, isDoctor: found.isDoctor === 1,
        });
        setLinkMode((found as Member & { portalAccess?: number }).portalAccess === 1 ? "invite_link" : "no_login_verify");
        setAddressData(parseAddress(found.address ?? null));
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfile() {
    setProfileLoading(true);
    try {
      const data = await orgApi.profile.get(userId);
      if (data.profile) {
        setProfile(data.profile);
        syncProfileForm(data.profile);
      }
    } catch {
      // non-fatal
    } finally {
      setProfileLoading(false);
    }
  }

  function syncProfileForm(p: StaffProfile) {
    setProfileForm({
      bio: p.bio ?? "",
      specialization: p.specialization ?? "",
      yearsExperience: p.yearsExperience != null ? String(p.yearsExperience) : "",
      languages: p.languages ?? [],
      qualifications: p.qualifications.length > 0 ? p.qualifications : [],
      idaNumber: p.idaNumber ?? "",
      dciNumber: p.dciNumber ?? "",
      stateCouncilNumber: p.stateCouncilNumber ?? "",
      licenseExpiry: p.licenseExpiry ?? "",
      previousEmployer: p.previousEmployer ?? "",
    });
  }

  async function fetchEmergencyContacts() {
    try {
      const data = await emergencyContactsApi.list("USER", userId);
      setEmergencyContacts((data.contacts ?? []) as EmergencyContact[]);
    } catch { /* non-fatal */ }
  }

  async function fetchSalary() {
    try {
      const data = await orgApi.salary.list();
      setSalaryRecords((data.records ?? []).filter((r: SalaryRecord & { userId: string }) => r.userId === userId));
    } catch { /* non-fatal */ }
  }

  function validatePhone(phone: string) {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return "Phone must have at least 10 digits";
    if (digits.length > 15) return "Phone number is too long";
    return "";
  }

  async function handleSave() {
    const pErr = validatePhone(editForm.phone);
    if (pErr) { setPhoneError(pErr); return; }
    setPhoneError("");
    setSaving(true); setSaveError(""); setSaveSuccess(false);
    try {
      await usersApi.update(userId, {
        name: editForm.name, phone: editForm.phone || null,
        dateOfBirth: editForm.dateOfBirth || null, gender: editForm.gender || null,
        address: serializeAddress(addressData) || null,
      });
      await orgApi.members.update(userId, {
        role: editForm.role,
        salaryType: editForm.salaryType as "FIXED" | "PER_APPOINTMENT",
        salaryAmount: parseFloat(editForm.salaryAmount) || 0,
        isActive: editForm.isActive, isDoctor: editForm.isDoctor,
      });
      setSaveSuccess(true); setEditing(false);
      await fetchMember();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setProfileSaving(true); setProfileError(""); setProfileSuccess(false);
    try {
      const data = await orgApi.profile.update(userId, {
        bio: profileForm.bio || null,
        specialization: profileForm.specialization || null,
        yearsExperience: profileForm.yearsExperience ? parseInt(profileForm.yearsExperience) : null,
        languages: profileForm.languages,
        qualifications: profileForm.qualifications.filter((q) => q.degree && q.institution),
        idaNumber: profileForm.idaNumber || null,
        dciNumber: profileForm.dciNumber || null,
        stateCouncilNumber: profileForm.stateCouncilNumber || null,
        licenseExpiry: profileForm.licenseExpiry || null,
        previousEmployer: profileForm.previousEmployer || null,
      });
      setProfile(data.profile);
      syncProfileForm(data.profile);
      setProfileSuccess(true); setEditingProfile(false);
    } catch (e) {
      setProfileError(e instanceof ApiError ? e.message : "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true); setDocError("");
    try {
      const data = await orgApi.profile.uploadDoc(userId, file, docType);
      setProfile((prev) => ({ ...prev, documents: [...prev.documents, data.document] }));
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteDoc(docId: string) {
    setDeletingDocId(docId); setDocError("");
    try {
      await orgApi.profile.deleteDoc(userId, docId);
      setProfile((prev) => ({ ...prev, documents: prev.documents.filter((d) => d.id !== docId) }));
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setDeletingDocId(null);
    }
  }

  async function handleAddEC() {
    setEcSaving(true); setEcError("");
    try {
      await emergencyContactsApi.add({ entityType: "USER", entityId: userId, ...ecForm });
      setAddingEC(false); setEcForm({ name: "", relationship: "", phone: "", email: "" });
      await fetchEmergencyContacts();
    } catch (e) {
      setEcError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setEcSaving(false);
    }
  }

  async function handleSendLink() {
    setSendingLink(true); setLinkError(""); setLinkSent(false);
    try {
      await orgApi.members.sendActivation(userId, linkMode);
      setLinkSent(true);
    } catch (e) {
      setLinkError(e instanceof ApiError ? e.message : "Failed to send link");
    } finally {
      setSendingLink(false);
    }
  }

  async function handleSendPhoneOtp() {
    if (!member?.phone) return;
    setSendingPhoneOtp(true); setPhoneOtpResult(null);
    try {
      const res = await fetch("/api/staff/send-phone-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json() as { sent?: boolean; error?: string; smsSent?: boolean; emailSent?: boolean };
      if (res.ok && data.sent) {
        const channels = [data.smsSent ? "SMS" : null, data.emailSent ? "email" : null].filter(Boolean).join(" + ");
        setPhoneOtpResult({ ok: true, msg: `OTP sent via ${channels} to ${member.phone}` });
      } else {
        setPhoneOtpResult({ ok: false, msg: data.error ?? "Failed to send OTP" });
      }
    } catch {
      setPhoneOtpResult({ ok: false, msg: "Network error — please try again" });
    } finally {
      setSendingPhoneOtp(false);
    }
  }

  function toggleLanguage(lang: string) {
    setProfileForm((f) => ({
      ...f,
      languages: f.languages.includes(lang)
        ? f.languages.filter((l) => l !== lang)
        : [...f.languages, lang],
    }));
  }

  function updateQual(index: number, field: keyof Qualification, value: string) {
    setProfileForm((f) => {
      const qs = [...f.qualifications];
      qs[index] = { ...qs[index], [field]: value };
      return { ...f, qualifications: qs };
    });
  }

  function removeQual(index: number) {
    setProfileForm((f) => ({ ...f, qualifications: f.qualifications.filter((_, i) => i !== index) }));
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-pk-text-muted">Loading...</div>;
  if (!member) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="text-pk-text-muted">Staff member not found.</p>
      <button onClick={() => router.push("/dashboard/staff")} className="text-pk-teal-600 hover:underline text-sm">
        Back to Staff
      </button>
    </div>
  );

  const hasProfile = profile.qualifications.length > 0 || profile.idaNumber || profile.dciNumber || profile.bio || profile.specialization;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={member.name}
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Staff", href: "/dashboard/staff" },
          { label: member.name },
        ]}
      />
      <main id="main-content" className="flex-1 p-6 max-w-3xl space-y-6">

        {/* ── Personal Profile ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Staff Profile</CardTitle>
              {!editing && (
                <Button size="sm" variant="outline" onClick={() => { setEditing(true); setSaveSuccess(false); }}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-5 mb-6">
              <div className="w-14 h-14 bg-pk-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-pk-teal-700 text-2xl font-bold">{member.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-pk-text">{member.name}</h2>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_COLORS[member.role] || "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                    {member.role}
                  </span>
                  {!member.isActive && (
                    <span className="text-xs bg-pk-danger-fill text-pk-danger-text px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-pk-text-muted">{member.email}</p>
                {profile.specialization && (
                  <p className="text-sm text-pk-teal-700 mt-0.5 font-medium">{profile.specialization}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Phone</p>
                <p className="font-medium text-pk-text">{member.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Gender</p>
                <p className="font-medium text-pk-text">{member.gender || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Date of Birth</p>
                <p className="font-medium text-pk-text">{member.dateOfBirth || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Joined</p>
                <p className="font-medium text-pk-text">{member.joinedAt || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Salary</p>
                <p className="font-medium text-pk-text">
                  ₹{(member.salaryAmount ?? 0).toLocaleString("en-IN")}
                  {member.salaryType === "PER_APPOINTMENT" ? "/appt" : "/month"}
                </p>
              </div>
              {member.address && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-pk-text-muted mb-0.5">Address</p>
                  <p className="font-medium text-pk-text">{formatAddressDisplay(parseAddress(member.address))}</p>
                </div>
              )}
            </div>

            {editing && (
              <div className="border-t border-pk-border pt-5 space-y-4">
                <p className="text-sm font-semibold text-pk-text-secondary">Edit Personal Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Name</label>
                    <input type="text" value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Phone</label>
                    <input type="tel" value={editForm.phone}
                      onChange={(e) => { setEditForm((f) => ({ ...f, phone: e.target.value })); setPhoneError(""); }}
                      className={`w-full px-3 py-2 border rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 ${phoneError ? "border-pk-danger-border" : "border-pk-border-strong"}`}
                      placeholder="+91 98765 43210" />
                    {phoneError && <p className="text-xs text-pk-danger-text mt-1">{phoneError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Date of Birth</label>
                    <input type="date" value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Gender</label>
                    <select value={editForm.gender}
                      onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="">— Select —</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Address</label>
                    <AddressForm value={addressData} onChange={setAddressData} />
                  </div>
                </div>

                <p className="text-sm font-semibold text-pk-text-secondary pt-2">Role &amp; Salary</p>
                {saveError && (
                  <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{saveError}</div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Role</label>
                    <select value={editForm.role}
                      onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Status</label>
                    <select value={editForm.isActive ? "active" : "inactive"}
                      onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.value === "active" }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  {editForm.role === "ADMIN" && (
                    <div className="flex items-center justify-between py-2 px-3 border border-pk-border rounded-pk-sm">
                      <div>
                        <p className="text-sm font-medium text-pk-text-secondary">Can act as Doctor</p>
                        <p className="text-xs text-pk-text-muted">Appears in the doctor dropdown</p>
                      </div>
                      <button type="button"
                        onClick={() => setEditForm((f) => ({ ...f, isDoctor: !f.isDoctor }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isDoctor ? "bg-pk-teal-600" : "bg-pk-surface-sunken"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-pk-surface shadow transition-transform ${editForm.isDoctor ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Salary Type</label>
                    <select value={editForm.salaryType}
                      onChange={(e) => setEditForm((f) => ({ ...f, salaryType: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="FIXED">Fixed Monthly</option>
                      <option value="PER_APPOINTMENT">Per Appointment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">
                      {editForm.salaryType === "PER_APPOINTMENT" ? "Rate per Appointment (₹)" : "Monthly Salary (₹)"}
                    </label>
                    <input type="number" min="0" value={editForm.salaryAmount}
                      onChange={(e) => setEditForm((f) => ({ ...f, salaryAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                  <Button variant="outline" onClick={() => { setEditing(false); setSaveError(""); setPhoneError(""); }}>Cancel</Button>
                </div>
              </div>
            )}

            {saveSuccess && (
              <div className="mt-4 bg-pk-success-fill border border-pk-success-border text-pk-success-text text-sm rounded-pk-sm px-4 py-3">
                Changes saved successfully.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Professional Profile ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Professional Profile</CardTitle>
              {!editingProfile && !profileLoading && (
                <Button size="sm" variant="outline" onClick={() => { setEditingProfile(true); setProfileSuccess(false); syncProfileForm(profile); }}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {hasProfile ? "Edit" : "Add"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <p className="text-sm text-pk-text-muted">Loading…</p>
            ) : !editingProfile ? (
              <>
                {!hasProfile && (
                  <p className="text-sm text-pk-text-muted">No professional profile added yet. Click &ldquo;Add&rdquo; to fill in qualifications, registrations, and bio.</p>
                )}
                {profile.bio && (
                  <div className="mb-4">
                    <p className="text-xs text-pk-text-muted mb-1">Bio</p>
                    <p className="text-sm text-pk-text leading-relaxed">{profile.bio}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  {profile.specialization && (
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">Specialization</p>
                      <p className="font-medium text-pk-text">{profile.specialization}</p>
                    </div>
                  )}
                  {profile.yearsExperience != null && (
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">Experience</p>
                      <p className="font-medium text-pk-text">{profile.yearsExperience} year{profile.yearsExperience !== 1 ? "s" : ""}</p>
                    </div>
                  )}
                  {profile.idaNumber && (
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">IDA Number</p>
                      <p className="font-medium text-pk-text font-mono">{profile.idaNumber}</p>
                    </div>
                  )}
                  {profile.dciNumber && (
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">DCI Registration</p>
                      <p className="font-medium text-pk-text font-mono">{profile.dciNumber}</p>
                    </div>
                  )}
                  {profile.stateCouncilNumber && (
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">State Council No.</p>
                      <p className="font-medium text-pk-text font-mono">{profile.stateCouncilNumber}</p>
                    </div>
                  )}
                  {profile.licenseExpiry && (
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">Licence Expiry</p>
                      <p className={`font-medium ${new Date(profile.licenseExpiry) < new Date() ? "text-pk-danger-text" : "text-pk-text"}`}>
                        {profile.licenseExpiry}
                      </p>
                    </div>
                  )}
                  {profile.previousEmployer && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-xs text-pk-text-muted mb-0.5">Previous Employer</p>
                      <p className="font-medium text-pk-text">{profile.previousEmployer}</p>
                    </div>
                  )}
                </div>

                {profile.qualifications.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-pk-text-muted mb-2">Qualifications</p>
                    <div className="space-y-2">
                      {profile.qualifications.map((q) => (
                        <div key={q.id} className="flex items-start gap-3 py-2 px-3 bg-pk-surface-raised rounded-pk-sm">
                          <div className="w-8 h-8 bg-pk-teal-100 rounded flex items-center justify-center flex-shrink-0 text-pk-teal-700">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-pk-text">{q.degree}</p>
                            <p className="text-xs text-pk-text-secondary">{q.institution}{q.year ? ` · ${q.year}` : ""}</p>
                            {q.notes && <p className="text-xs text-pk-text-muted mt-0.5">{q.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.languages.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-pk-text-muted mb-2">Languages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.languages.map((l) => (
                        <span key={l} className="text-xs bg-pk-teal-100 text-pk-teal-700 px-2.5 py-1 rounded-full">{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Edit Form */
              <div className="space-y-5">
                {profileError && (
                  <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{profileError}</div>
                )}

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Bio / About</label>
                  <textarea rows={3} value={profileForm.bio}
                    onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                    placeholder="Brief professional background, areas of interest…"
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Specialization */}
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Specialization</label>
                    <select value={profileForm.specialization}
                      onChange={(e) => setProfileForm((f) => ({ ...f, specialization: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="">— Select —</option>
                      {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Years of Experience */}
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Years of Experience</label>
                    <input type="number" min="0" max="60" value={profileForm.yearsExperience}
                      onChange={(e) => setProfileForm((f) => ({ ...f, yearsExperience: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                      placeholder="e.g. 8" />
                  </div>

                  {/* Previous Employer */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Previous Employer / Clinic</label>
                    <input type="text" value={profileForm.previousEmployer}
                      onChange={(e) => setProfileForm((f) => ({ ...f, previousEmployer: e.target.value }))}
                      placeholder="e.g. Apollo Dental, Chennai"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                </div>

                {/* Registrations */}
                <div>
                  <p className="text-sm font-semibold text-pk-text-secondary mb-3">Professional Registrations</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">IDA Membership No.</label>
                      <input type="text" value={profileForm.idaNumber}
                        onChange={(e) => setProfileForm((f) => ({ ...f, idaNumber: e.target.value }))}
                        placeholder="e.g. IDA/TN/2015/12345"
                        className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">DCI Registration No.</label>
                      <input type="text" value={profileForm.dciNumber}
                        onChange={(e) => setProfileForm((f) => ({ ...f, dciNumber: e.target.value }))}
                        placeholder="Dental Council of India no."
                        className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">State Dental Council No.</label>
                      <input type="text" value={profileForm.stateCouncilNumber}
                        onChange={(e) => setProfileForm((f) => ({ ...f, stateCouncilNumber: e.target.value }))}
                        placeholder="e.g. TNDC/2015/5678"
                        className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Licence Expiry Date</label>
                      <input type="date" value={profileForm.licenseExpiry}
                        onChange={(e) => setProfileForm((f) => ({ ...f, licenseExpiry: e.target.value }))}
                        className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                    </div>
                  </div>
                </div>

                {/* Qualifications */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-pk-text-secondary">Academic Qualifications</p>
                    <Button size="sm" variant="outline"
                      onClick={() => setProfileForm((f) => ({ ...f, qualifications: [...f.qualifications, emptyQual()] }))}>
                      + Add Degree
                    </Button>
                  </div>
                  {profileForm.qualifications.length === 0 && (
                    <p className="text-sm text-pk-text-muted">No qualifications added yet.</p>
                  )}
                  <div className="space-y-3">
                    {profileForm.qualifications.map((q, i) => (
                      <div key={q.id} className="p-3 border border-pk-border rounded-pk-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-pk-text-secondary uppercase tracking-wide">Degree {i + 1}</p>
                          <button type="button" onClick={() => removeQual(i)}
                            className="text-xs text-pk-danger-text hover:underline">Remove</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-pk-text-secondary mb-1">Degree / Certification *</label>
                            <input type="text" value={q.degree} onChange={(e) => updateQual(i, "degree", e.target.value)}
                              placeholder="e.g. BDS, MDS, BPT"
                              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-pk-text-secondary mb-1">Year of Completion</label>
                            <input type="text" value={q.year} onChange={(e) => updateQual(i, "year", e.target.value)}
                              placeholder="e.g. 2015" maxLength={4}
                              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-pk-text-secondary mb-1">University / Institution *</label>
                            <input type="text" value={q.institution} onChange={(e) => updateQual(i, "institution", e.target.value)}
                              placeholder="e.g. SRM Dental College, Chennai"
                              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-pk-text-secondary mb-1">Notes (optional)</label>
                            <input type="text" value={q.notes ?? ""} onChange={(e) => updateQual(i, "notes", e.target.value)}
                              placeholder="e.g. Specialization in Orthodontics, Gold Medal"
                              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Languages */}
                <div>
                  <p className="text-sm font-semibold text-pk-text-secondary mb-2">Languages Spoken</p>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_LANGUAGES.map((lang) => (
                      <button key={lang} type="button" onClick={() => toggleLanguage(lang)}
                        className={`text-sm px-3 py-1.5 rounded-full border transition ${
                          profileForm.languages.includes(lang)
                            ? "bg-pk-teal-600 text-white border-pk-teal-600"
                            : "border-pk-border text-pk-text-secondary hover:border-pk-teal-500"
                        }`}>
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button onClick={handleSaveProfile} disabled={profileSaving}>
                    {profileSaving ? "Saving…" : "Save Profile"}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditingProfile(false); setProfileError(""); }}>Cancel</Button>
                </div>
              </div>
            )}

            {profileSuccess && (
              <div className="mt-4 bg-pk-success-fill border border-pk-success-border text-pk-success-text text-sm rounded-pk-sm px-4 py-3">
                Professional profile saved.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Credential Documents (with admin review) ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Credential Documents
                {profile.documents.filter((d) => d.status === "PENDING").length > 0 && (
                  <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-pk-warning-fill text-pk-warning-text">
                    {profile.documents.filter((d) => d.status === "PENDING").length} pending review
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <select value={docType} onChange={(e) => setDocType(e.target.value as CredentialDocType)}
                  className="text-sm px-2 py-1.5 border border-pk-border-strong rounded-pk-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                  {ALL_DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                </select>
                <Button size="sm" variant="outline" disabled={uploadingDoc} onClick={() => fileInputRef.current?.click()}>
                  {uploadingDoc ? "Uploading…" : "+ Upload"}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleDocUpload} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {docError && <div className="mb-3 bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{docError}</div>}
            {profile.documents.length === 0 ? (
              <p className="text-sm text-pk-text-muted">No documents uploaded. Select a type and upload degree certificates, IDA card, etc.</p>
            ) : (
              <div className="space-y-2">
                {profile.documents.map((doc) => (
                  <DocReviewRow
                    key={doc.id}
                    doc={doc}
                    userId={userId}
                    deletingDocId={deletingDocId}
                    onDelete={handleDeleteDoc}
                    onReviewed={(updated) => setProfile((prev) => ({
                      ...prev,
                      documents: prev.documents.map((d) => d.id === updated.id ? updated : d),
                    }))}
                  />
                ))}
              </div>
            )}
            <p className="text-xs text-pk-text-muted mt-3">Accepted: PDF, JPEG, PNG, WebP · Max 10 MB per file · Admin uploads are auto-verified</p>
          </CardContent>
        </Card>

        {/* ── Emergency Contacts ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Emergency Contacts</CardTitle>
              <Button size="sm" variant="outline" onClick={() => { setAddingEC(true); setEcError(""); }}>+ Add</Button>
            </div>
          </CardHeader>
          <CardContent>
            {emergencyContacts.length === 0 && !addingEC && (
              <p className="text-sm text-pk-text-muted">No emergency contacts added.</p>
            )}
            {emergencyContacts.map((ec) => (
              <div key={ec.id} className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-pk-border last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-pk-text">{ec.name} <span className="text-pk-text-muted font-normal">({ec.relationship})</span></p>
                  <p className="text-sm text-pk-text-secondary">{ec.phone}{ec.email ? ` · ${ec.email}` : ""}</p>
                  {ec.address && <p className="text-xs text-pk-text-muted mt-0.5">{ec.address}</p>}
                </div>
              </div>
            ))}
            {addingEC && (
              <div className="mt-3 space-y-3 border-t border-pk-border pt-4">
                {ecError && <p className="text-sm text-pk-danger-text">{ecError}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Name *</label>
                    <input type="text" value={ecForm.name} onChange={(e) => setEcForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Relationship *</label>
                    <input type="text" value={ecForm.relationship} onChange={(e) => setEcForm((f) => ({ ...f, relationship: e.target.value }))}
                      placeholder="Spouse, Parent, Sibling…"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Phone *</label>
                    <input type="tel" value={ecForm.phone} onChange={(e) => setEcForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Email</label>
                    <input type="email" value={ecForm.email} onChange={(e) => setEcForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddEC} disabled={ecSaving || !ecForm.name || !ecForm.relationship || !ecForm.phone}>
                    {ecSaving ? "Saving…" : "Save Contact"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setAddingEC(false); setEcError(""); }}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Account Access (redesigned) ── */}
        <Card>
          <CardHeader><CardTitle>Account Access</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            {/* Status row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "HR Status",
                  value: member.isActive ? "Active" : "Inactive",
                  icon: member.isActive
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />,
                  color: member.isActive ? "text-pk-success-text bg-pk-success-fill" : "text-pk-text-muted bg-pk-surface-sunken",
                },
                {
                  label: "Portal Login",
                  value: member.portalAccess ? "Enabled" : "Disabled",
                  icon: member.portalAccess
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
                  color: member.portalAccess ? "text-pk-teal-700 bg-pk-teal-100" : "text-pk-warning-text bg-pk-warning-fill",
                },
                {
                  label: "Verification",
                  value: member.isVerified ? "Verified" : "Pending",
                  icon: member.isVerified
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
                  color: member.isVerified ? "text-teal-700 bg-teal-100" : "text-pk-warning-text bg-pk-warning-fill",
                },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-pk-sm border border-pk-border text-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.color}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                  </div>
                  <p className="text-xs text-pk-text-muted leading-tight">{item.label}</p>
                  <p className="text-xs font-semibold text-pk-text leading-tight">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Send invitation actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-pk-text">Send Activation Email</p>
                  <p className="text-xs text-pk-text-muted mt-0.5">Staff sets their own password and verifies email + phone. Login is enabled after.</p>
                </div>
                <Button size="sm" onClick={() => { setLinkMode("invite_link"); handleSendLink(); }} disabled={sendingLink && linkMode === "invite_link"}>
                  {sendingLink && linkMode === "invite_link" ? "Sending…" : "Send"}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-pk-text">Send Verification Only</p>
                  <p className="text-xs text-pk-text-muted mt-0.5">Verifies email and phone without enabling login access.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setLinkMode("no_login_verify"); handleSendLink(); }} disabled={sendingLink && linkMode === "no_login_verify"}>
                  {sendingLink && linkMode === "no_login_verify" ? "Sending…" : "Send"}
                </Button>
              </div>
              {linkError && <p className="text-xs text-pk-danger-text">{linkError}</p>}
              {linkSent && <p className="text-xs text-pk-success-text">Email sent to {member.email}</p>}
            </div>

            {/* Phone OTP */}
            {member.phone && (
              <div className="flex items-center justify-between border-t border-pk-border pt-4">
                <div>
                  <p className="text-sm font-medium text-pk-text">Phone Verification OTP</p>
                  <p className="text-xs text-pk-text-muted mt-0.5">Send a one-time code to <span className="font-mono">{member.phone}</span></p>
                  {phoneOtpResult && (
                    <p className={`text-xs mt-1 ${phoneOtpResult.ok ? "text-pk-success-text" : "text-pk-danger-text"}`}>{phoneOtpResult.msg}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={handleSendPhoneOtp} disabled={sendingPhoneOtp}>
                  {sendingPhoneOtp ? "Sending…" : "Send OTP"}
                </Button>
              </div>
            )}

            {/* Danger Zone */}
            <details className="border border-pk-danger-border rounded-pk-sm">
              <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-sm font-medium text-pk-danger-text select-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Danger Zone
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-pk-danger-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-pk-text">{member.isActive ? "Deactivate Staff" : "Reactivate Staff"}</p>
                    <p className="text-xs text-pk-text-muted">{member.isActive ? "Removes HR access. Login is also disabled." : "Restores HR active status."}</p>
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={async () => {
                      await orgApi.members.update(userId, { isActive: !member.isActive });
                      await fetchMember();
                    }}
                    className="text-pk-danger-text border-pk-danger-border hover:bg-pk-danger-fill">
                    {member.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>
            </details>

          </CardContent>
        </Card>

        {/* ── Salary History ── */}
        {salaryRecords.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Salary History</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pk-border">
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Month</th>
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Amount</th>
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Paid</th>
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Appts</th>
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pk-border">
                  {salaryRecords.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 text-pk-text-secondary">{r.month}</td>
                      <td className="py-2 text-pk-text-secondary">₹{r.salaryAmount.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-pk-text-secondary">₹{r.paidAmount.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-pk-text-muted">{r.appointmentCount || "—"}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.status === "PAID" ? "bg-pk-success-fill text-pk-success-text"
                          : r.status === "PARTIAL" ? "bg-pk-warning-fill text-pk-warning-text"
                          : "bg-pk-surface-sunken text-pk-text-secondary"
                        }`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <button onClick={() => router.push("/dashboard/staff")}
          className="text-sm text-pk-text-muted hover:text-pk-text-secondary transition">
          &larr; Back to Staff
        </button>
      </main>
    </div>
  );
}
