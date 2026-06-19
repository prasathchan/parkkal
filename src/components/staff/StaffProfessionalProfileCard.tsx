"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { orgApi, ApiError } from "@/api";
import type { StaffProfile, Qualification, CredentialDoc, CredentialDocType } from "@/types";

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
              <input type="text" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Rejection reason (optional)…"
                className="flex-1 px-2 py-1 text-xs border border-pk-danger-border rounded-pk-sm focus:outline-none focus:ring-1 focus:ring-pk-danger-border" />
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

export function StaffProfessionalProfileCard({ userId }: { userId: string }) {
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

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState<CredentialDocType>("DEGREE_CERTIFICATE");
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [docError, setDocError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function fetchProfile() {
    setProfileLoading(true);
    orgApi.profile.get(userId)
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          syncProfileForm(data.profile);
        }
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => setProfileLoading(false));
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

  const hasProfile = profile.qualifications.length > 0 || profile.idaNumber || profile.dciNumber || profile.bio || profile.specialization;

  return (
    <>
      {/* Professional Profile */}
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
            <div className="space-y-5">
              {profileError && (
                <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{profileError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Bio / About</label>
                <textarea rows={3} value={profileForm.bio}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Brief professional background, areas of interest…"
                  className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Specialization</label>
                  <select value={profileForm.specialization}
                    onChange={(e) => setProfileForm((f) => ({ ...f, specialization: e.target.value }))}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                    <option value="">— Select —</option>
                    {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Years of Experience</label>
                  <input type="number" min="0" max="60" value={profileForm.yearsExperience}
                    onChange={(e) => setProfileForm((f) => ({ ...f, yearsExperience: e.target.value }))}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                    placeholder="e.g. 8" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Previous Employer / Clinic</label>
                  <input type="text" value={profileForm.previousEmployer}
                    onChange={(e) => setProfileForm((f) => ({ ...f, previousEmployer: e.target.value }))}
                    placeholder="e.g. Apollo Dental, Chennai"
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                </div>
              </div>

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

      {/* Credential Documents */}
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
    </>
  );
}
