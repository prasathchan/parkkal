"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { orgApi, authApi, ApiError } from "@/api";
import type { StaffProfile, Qualification, CredentialDoc, CredentialDocType } from "@/types";

const SPECIALIZATIONS = [
  "General Dentistry", "Orthodontics", "Endodontics (Root Canal)",
  "Periodontics (Gum Disease)", "Oral and Maxillofacial Surgery",
  "Prosthodontics (Dental Prosthetics)", "Pediatric Dentistry",
  "Oral Pathology", "Oral Radiology", "Dental Public Health",
  "Cosmetic Dentistry", "Implantology", "Other",
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

function DocStatusBadge({ doc }: { doc: CredentialDoc }) {
  if (doc.status === "VERIFIED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-pk-success-fill text-pk-success-text">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        Verified
      </span>
    );
  }
  if (doc.status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-pk-danger-fill text-pk-danger-text">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-pk-warning-fill text-pk-warning-text">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      Pending Review
    </span>
  );
}

export default function MyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{ id: string; name: string; email: string; phone: string | null; dateOfBirth: string | null; gender: string | null; role: string } | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);

  // Personal info edit
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({ name: "", phone: "", dateOfBirth: "", gender: "" });
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalError, setPersonalError] = useState("");
  const [personalSuccess, setPersonalSuccess] = useState(false);

  // Professional profile edit
  const [editingProf, setEditingProf] = useState(false);
  const [profForm, setProfForm] = useState({
    bio: "", specialization: "", yearsExperience: "", languages: [] as string[],
    qualifications: [] as Qualification[], idaNumber: "", dciNumber: "",
    stateCouncilNumber: "", licenseExpiry: "", previousEmployer: "",
  });
  const [profSaving, setProfSaving] = useState(false);
  const [profError, setProfError] = useState("");
  const [profSuccess, setProfSuccess] = useState(false);

  // Password change
  const [editingPwd, setEditingPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);

  // Docs
  const [docType, setDocType] = useState<CredentialDocType>("DEGREE_CERTIFICATE");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orgApi.myProfile.get();
      setUserData(data.user);
      setPersonalForm({
        name: data.user.name || "",
        phone: data.user.phone || "",
        dateOfBirth: data.user.dateOfBirth || "",
        gender: data.user.gender || "",
      });
      if (data.profile) {
        setProfile(data.profile);
        syncProfForm(data.profile);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function syncProfForm(p: StaffProfile) {
    setProfForm({
      bio: p.bio ?? "", specialization: p.specialization ?? "",
      yearsExperience: p.yearsExperience != null ? String(p.yearsExperience) : "",
      languages: p.languages ?? [], qualifications: p.qualifications ?? [],
      idaNumber: p.idaNumber ?? "", dciNumber: p.dciNumber ?? "",
      stateCouncilNumber: p.stateCouncilNumber ?? "",
      licenseExpiry: p.licenseExpiry ?? "", previousEmployer: p.previousEmployer ?? "",
    });
  }

  async function handleSavePersonal() {
    setPersonalSaving(true); setPersonalError(""); setPersonalSuccess(false);
    try {
      await orgApi.myProfile.update({
        name: personalForm.name,
        phone: personalForm.phone || null,
        dateOfBirth: personalForm.dateOfBirth || null,
        gender: personalForm.gender || null,
      });
      setPersonalSuccess(true); setEditingPersonal(false);
      await fetchAll();
    } catch (e) {
      setPersonalError(e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setPersonalSaving(false);
    }
  }

  async function handleSaveProf() {
    setProfSaving(true); setProfError(""); setProfSuccess(false);
    try {
      await orgApi.myProfile.update({
        bio: profForm.bio || null,
        specialization: profForm.specialization || null,
        yearsExperience: profForm.yearsExperience ? parseInt(profForm.yearsExperience) : null,
        languages: profForm.languages,
        qualifications: profForm.qualifications.filter((q) => q.degree && q.institution),
        idaNumber: profForm.idaNumber || null,
        dciNumber: profForm.dciNumber || null,
        stateCouncilNumber: profForm.stateCouncilNumber || null,
        licenseExpiry: profForm.licenseExpiry || null,
        previousEmployer: profForm.previousEmployer || null,
      });
      setProfSuccess(true); setEditingProf(false);
      await fetchAll();
    } catch (e) {
      setProfError(e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setProfSaving(false);
    }
  }

  async function handleChangePwd() {
    if (pwdForm.next !== pwdForm.confirm) { setPwdError("Passwords do not match."); return; }
    if (pwdForm.next.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
    setPwdSaving(true); setPwdError(""); setPwdSuccess(false);
    try {
      await authApi.changePassword({ currentPassword: pwdForm.current, newPassword: pwdForm.next });
      setPwdSuccess(true); setEditingPwd(false); setPwdForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      setPwdError(e instanceof ApiError ? e.message : "Failed to change password.");
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true); setDocError("");
    try {
      const data = await orgApi.myProfile.uploadDoc(file, docType);
      setProfile((prev) => prev
        ? { ...prev, documents: [...prev.documents, data.document] }
        : { userId: userData!.id, bio: null, specialization: null, yearsExperience: null, languages: [], qualifications: [], idaNumber: null, dciNumber: null, stateCouncilNumber: null, licenseExpiry: null, previousEmployer: null, documents: [data.document], createdAt: Date.now(), updatedAt: Date.now() }
      );
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleLanguage(lang: string) {
    setProfForm((f) => ({
      ...f, languages: f.languages.includes(lang)
        ? f.languages.filter((l) => l !== lang)
        : [...f.languages, lang],
    }));
  }

  function updateQual(i: number, field: keyof Qualification, val: string) {
    setProfForm((f) => {
      const qs = [...f.qualifications];
      qs[i] = { ...qs[i], [field]: val };
      return { ...f, qualifications: qs };
    });
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-pk-text-muted">Loading…</div>;

  const docs = profile?.documents ?? [];
  const pendingDocs = docs.filter((d) => d.status === "PENDING").length;
  const rejectedDocs = docs.filter((d) => d.status === "REJECTED").length;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="My Profile"
        breadcrumb={[{ label: "Dashboard" }, { label: "My Profile" }]}
      />
      <main id="main-content" className="flex-1 p-6 max-w-3xl space-y-6">

        {/* ── Document status alert ── */}
        {(pendingDocs > 0 || rejectedDocs > 0) && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-pk-sm text-sm ${rejectedDocs > 0 ? "bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text" : "bg-pk-warning-fill border border-pk-warning-border text-pk-warning-text"}`}>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              {rejectedDocs > 0 && <p className="font-medium">{rejectedDocs} document{rejectedDocs > 1 ? "s were" : " was"} rejected by the admin. Please re-upload with correct files.</p>}
              {pendingDocs > 0 && rejectedDocs === 0 && <p className="font-medium">{pendingDocs} document{pendingDocs > 1 ? "s are" : " is"} awaiting admin review.</p>}
            </div>
          </div>
        )}

        {/* ── Personal Info ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Personal Information</CardTitle>
              {!editingPersonal && (
                <Button size="sm" variant="outline" onClick={() => { setEditingPersonal(true); setPersonalSuccess(false); }}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!editingPersonal ? (
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-full bg-pk-teal-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-pk-teal-700 text-2xl font-bold">{userData?.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-pk-text">{userData?.name}</h2>
                  <p className="text-sm text-pk-text-muted">{userData?.email}</p>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">Phone</p>
                      <p className="font-medium text-pk-text">{userData?.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">Gender</p>
                      <p className="font-medium text-pk-text">{userData?.gender || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-pk-text-muted mb-0.5">Date of Birth</p>
                      <p className="font-medium text-pk-text">{userData?.dateOfBirth || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {personalError && <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{personalError}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Full Name</label>
                    <input type="text" value={personalForm.name} onChange={(e) => setPersonalForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Phone</label>
                    <input type="tel" value={personalForm.phone} onChange={(e) => setPersonalForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Date of Birth</label>
                    <input type="date" value={personalForm.dateOfBirth} onChange={(e) => setPersonalForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Gender</label>
                    <select value={personalForm.gender} onChange={(e) => setPersonalForm((f) => ({ ...f, gender: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="">— Select —</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSavePersonal} disabled={personalSaving}>{personalSaving ? "Saving…" : "Save"}</Button>
                  <Button variant="outline" onClick={() => { setEditingPersonal(false); setPersonalError(""); }}>Cancel</Button>
                </div>
              </div>
            )}
            {personalSuccess && (
              <div className="mt-4 bg-pk-success-fill border border-pk-success-border text-pk-success-text text-sm rounded-pk-sm px-4 py-3">Profile updated successfully.</div>
            )}
          </CardContent>
        </Card>

        {/* ── Professional Profile ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Professional Profile</CardTitle>
              {!editingProf && (
                <Button size="sm" variant="outline" onClick={() => { setEditingProf(true); setProfSuccess(false); if (profile) syncProfForm(profile); }}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  {profile ? "Edit" : "Add"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!editingProf ? (
              <>
                {!profile && <p className="text-sm text-pk-text-muted">No professional profile yet. Click Add to fill in your qualifications and registrations.</p>}
                {profile?.bio && (
                  <div className="mb-4">
                    <p className="text-xs text-pk-text-muted mb-1">Bio</p>
                    <p className="text-sm text-pk-text leading-relaxed">{profile.bio}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  {profile?.specialization && <div><p className="text-xs text-pk-text-muted mb-0.5">Specialization</p><p className="font-medium text-pk-text">{profile.specialization}</p></div>}
                  {profile?.yearsExperience != null && <div><p className="text-xs text-pk-text-muted mb-0.5">Experience</p><p className="font-medium text-pk-text">{profile.yearsExperience} yrs</p></div>}
                  {profile?.idaNumber && <div><p className="text-xs text-pk-text-muted mb-0.5">IDA No.</p><p className="font-medium text-pk-text font-mono">{profile.idaNumber}</p></div>}
                  {profile?.dciNumber && <div><p className="text-xs text-pk-text-muted mb-0.5">DCI Reg.</p><p className="font-medium text-pk-text font-mono">{profile.dciNumber}</p></div>}
                  {profile?.stateCouncilNumber && <div><p className="text-xs text-pk-text-muted mb-0.5">State Council</p><p className="font-medium text-pk-text font-mono">{profile.stateCouncilNumber}</p></div>}
                  {profile?.licenseExpiry && <div><p className="text-xs text-pk-text-muted mb-0.5">Licence Expiry</p><p className={`font-medium ${new Date(profile.licenseExpiry) < new Date() ? "text-pk-danger-text" : "text-pk-text"}`}>{profile.licenseExpiry}</p></div>}
                </div>
                {(profile?.qualifications ?? []).length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-pk-text-muted">Qualifications</p>
                    {profile!.qualifications.map((q) => (
                      <div key={q.id} className="flex items-start gap-3 py-2 px-3 bg-pk-surface-raised rounded-pk-sm">
                        <div className="w-7 h-7 bg-pk-teal-100 rounded flex items-center justify-center flex-shrink-0 text-pk-teal-700">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /></svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-pk-text">{q.degree}</p>
                          <p className="text-xs text-pk-text-secondary">{q.institution}{q.year ? ` · ${q.year}` : ""}</p>
                          {q.notes && <p className="text-xs text-pk-text-muted">{q.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(profile?.languages ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {profile!.languages.map((l) => (
                      <span key={l} className="text-xs bg-pk-teal-100 text-pk-teal-700 px-2.5 py-1 rounded-full">{l}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-5">
                {profError && <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{profError}</div>}
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Bio / About</label>
                  <textarea rows={3} value={profForm.bio} onChange={(e) => setProfForm((f) => ({ ...f, bio: e.target.value }))}
                    placeholder="Brief professional background…"
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Specialization</label>
                    <select value={profForm.specialization} onChange={(e) => setProfForm((f) => ({ ...f, specialization: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="">— Select —</option>
                      {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Years of Experience</label>
                    <input type="number" min="0" max="60" value={profForm.yearsExperience} onChange={(e) => setProfForm((f) => ({ ...f, yearsExperience: e.target.value }))}
                      placeholder="e.g. 8"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">IDA Membership No.</label>
                    <input type="text" value={profForm.idaNumber} onChange={(e) => setProfForm((f) => ({ ...f, idaNumber: e.target.value }))}
                      placeholder="IDA/TN/2015/12345"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">DCI Registration No.</label>
                    <input type="text" value={profForm.dciNumber} onChange={(e) => setProfForm((f) => ({ ...f, dciNumber: e.target.value }))}
                      placeholder="DCI number"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">State Dental Council No.</label>
                    <input type="text" value={profForm.stateCouncilNumber} onChange={(e) => setProfForm((f) => ({ ...f, stateCouncilNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Licence Expiry</label>
                    <input type="date" value={profForm.licenseExpiry} onChange={(e) => setProfForm((f) => ({ ...f, licenseExpiry: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Previous Employer</label>
                    <input type="text" value={profForm.previousEmployer} onChange={(e) => setProfForm((f) => ({ ...f, previousEmployer: e.target.value }))}
                      placeholder="e.g. Apollo Dental, Chennai"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                </div>

                {/* Qualifications */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-pk-text-secondary">Qualifications</p>
                    <Button size="sm" variant="outline" onClick={() => setProfForm((f) => ({ ...f, qualifications: [...f.qualifications, emptyQual()] }))}>+ Add Degree</Button>
                  </div>
                  {profForm.qualifications.length === 0 && <p className="text-sm text-pk-text-muted">No qualifications added.</p>}
                  <div className="space-y-3">
                    {profForm.qualifications.map((q, i) => (
                      <div key={q.id} className="p-3 border border-pk-border rounded-pk-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-pk-text-secondary uppercase tracking-wide">Degree {i + 1}</p>
                          <button type="button" onClick={() => setProfForm((f) => ({ ...f, qualifications: f.qualifications.filter((_, j) => j !== i) }))}
                            className="text-xs text-pk-danger-text hover:underline">Remove</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-pk-text-secondary mb-1">Degree *</label>
                            <input type="text" value={q.degree} onChange={(e) => updateQual(i, "degree", e.target.value)} placeholder="BDS, MDS…"
                              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-pk-text-secondary mb-1">Year</label>
                            <input type="text" value={q.year} onChange={(e) => updateQual(i, "year", e.target.value)} placeholder="2015" maxLength={4}
                              className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-pk-text-secondary mb-1">Institution *</label>
                            <input type="text" value={q.institution} onChange={(e) => updateQual(i, "institution", e.target.value)} placeholder="University / College"
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
                        className={`text-sm px-3 py-1.5 rounded-full border transition ${profForm.languages.includes(lang) ? "bg-pk-teal-600 text-white border-pk-teal-600" : "border-pk-border text-pk-text-secondary hover:border-pk-teal-500"}`}>
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSaveProf} disabled={profSaving}>{profSaving ? "Saving…" : "Save Profile"}</Button>
                  <Button variant="outline" onClick={() => { setEditingProf(false); setProfError(""); }}>Cancel</Button>
                </div>
              </div>
            )}
            {profSuccess && <div className="mt-4 bg-pk-success-fill border border-pk-success-border text-pk-success-text text-sm rounded-pk-sm px-4 py-3">Professional profile saved.</div>}
          </CardContent>
        </Card>

        {/* ── Credential Documents ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Credential Documents</CardTitle>
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
            <div className="mb-3 flex items-start gap-2 text-xs text-pk-text-muted">
              <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-pk-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Documents you upload go to <strong className="text-pk-text-secondary">Pending Review</strong> until an admin verifies them. You will see the status here.
            </div>
            {docError && <div className="mb-3 bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{docError}</div>}
            {docs.length === 0 ? (
              <p className="text-sm text-pk-text-muted">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className={`flex items-start gap-3 p-3 border rounded-pk-sm ${doc.status === "REJECTED" ? "border-pk-danger-border bg-pk-danger-fill/30" : doc.status === "VERIFIED" ? "border-pk-success-border" : "border-pk-border"}`}>
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
                        <DocStatusBadge doc={doc} />
                      </div>
                      <p className="text-xs text-pk-text-muted mt-0.5">{DOC_TYPE_LABELS[doc.docType]} · {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</p>
                      {doc.status === "REJECTED" && doc.reviewNote && (
                        <p className="text-xs text-pk-danger-text mt-1 flex items-start gap-1">
                          <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Reason: {doc.reviewNote}
                        </p>
                      )}
                    </div>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-pk-teal-600 hover:underline font-medium flex-shrink-0">View</a>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-pk-text-muted mt-3">Accepted: PDF, JPEG, PNG, WebP · Max 10 MB per file</p>
          </CardContent>
        </Card>

        {/* ── Change Password ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Change Password</CardTitle>
              {!editingPwd && (
                <Button size="sm" variant="outline" onClick={() => { setEditingPwd(true); setPwdSuccess(false); }}>Change</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!editingPwd ? (
              <p className="text-sm text-pk-text-muted">Use a strong password with at least 8 characters including letters and numbers.</p>
            ) : (
              <div className="space-y-4">
                {pwdError && <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{pwdError}</div>}
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Current Password</label>
                  <input type="password" value={pwdForm.current} onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">New Password</label>
                  <input type="password" value={pwdForm.next} onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Confirm New Password</label>
                  <input type="password" value={pwdForm.confirm} onChange={(e) => setPwdForm((f) => ({ ...f, confirm: e.target.value }))}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleChangePwd} disabled={pwdSaving}>{pwdSaving ? "Saving…" : "Update Password"}</Button>
                  <Button variant="outline" onClick={() => { setEditingPwd(false); setPwdError(""); }}>Cancel</Button>
                </div>
              </div>
            )}
            {pwdSuccess && <div className="mt-4 bg-pk-success-fill border border-pk-success-border text-pk-success-text text-sm rounded-pk-sm px-4 py-3">Password updated successfully.</div>}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
