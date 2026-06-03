"use client";

import { useEffect, useState } from "react";

interface OrgInfo {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

export default function ConsentFormPage() {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  useEffect(() => {
    fetch("/api/org/profile")
      .then((r) => r.json())
      .then((d) => setOrg(d.organization))
      .catch(() => {});
  }, []);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
        }
        body { background: #f3f4f6; margin: 0; font-family: 'Times New Roman', serif; }
        .print-page { max-width: 780px; margin: 32px auto; background: white; padding: 48px 56px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
        .tamil { font-family: 'Latha', 'Vijaya', 'Tamil MN', serif; }
        h1 { font-size: 22px; font-weight: bold; text-align: center; margin: 0 0 4px; }
        h2 { font-size: 15px; text-align: center; margin: 0 0 24px; color: #374151; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #374151; padding-bottom: 3px; margin-bottom: 8px; }
        .bilingual { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        p { font-size: 12px; line-height: 1.7; margin: 0 0 8px; color: #1f2937; }
        .field-line { border-bottom: 1px solid #374151; min-height: 24px; margin-bottom: 4px; }
        .field-label { font-size: 11px; color: #4b5563; margin-bottom: 12px; }
        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 32px; }
        .sig-block { text-align: center; }
        .sig-line { border-bottom: 1px solid #374151; margin-bottom: 6px; height: 48px; }
        .sig-label { font-size: 11px; color: #4b5563; }
        .stamp-area { border: 2px dashed #d1d5db; height: 100px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 11px; margin-top: 12px; }
      `}</style>

      <div className="no-print" style={{ background: "#e5e7eb", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "14px", color: "#374151", fontFamily: "system-ui" }}>
          Print this page → Patient signs → Scan/photo → Upload to treatment record
        </span>
        <button
          onClick={() => window.print()}
          style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 20px", borderRadius: "8px", fontSize: "14px", cursor: "pointer", fontFamily: "system-ui" }}
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="print-page">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ flex: 1 }}>
            {org?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="Clinic logo" style={{ height: "60px", objectFit: "contain" }} />
            )}
          </div>
          <div style={{ flex: 2, textAlign: "center" }}>
            <h1>{org?.name ?? "Dental Clinic"}</h1>
            {org?.address && <p style={{ fontSize: "11px", margin: "2px 0" }}>{org.address}</p>}
            {org?.phone && <p style={{ fontSize: "11px", margin: "2px 0" }}>📞 {org.phone}</p>}
            {org?.email && <p style={{ fontSize: "11px", margin: "2px 0" }}>✉ {org.email}</p>}
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <p style={{ fontSize: "11px", color: "#6b7280" }}>Date / தேதி</p>
            <p style={{ fontSize: "13px", fontWeight: "bold" }}>{today}</p>
          </div>
        </div>

        <h2>DENTAL TREATMENT CONSENT FORM / பல் சிகிச்சை சம்மதப் படிவம்</h2>

        {/* Patient Details */}
        <div className="section">
          <div className="section-title">PATIENT DETAILS / நோயாளர் விவரங்கள்</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div className="field-line" />
              <div className="field-label">Patient Name / நோயாளர் பெயர்</div>
            </div>
            <div>
              <div className="field-line" />
              <div className="field-label">Patient Code / நோயாளர் குறியீடு</div>
            </div>
            <div>
              <div className="field-line" />
              <div className="field-label">Date of Birth / பிறந்த தேதி</div>
            </div>
            <div>
              <div className="field-line" />
              <div className="field-label">Phone / தொலைபேசி</div>
            </div>
            <div>
              <div className="field-line" />
              <div className="field-label">Treatment / சிகிச்சை விவரம்</div>
            </div>
            <div>
              <div className="field-line" />
              <div className="field-label">Treating Doctor / சிகிச்சை மருத்துவர்</div>
            </div>
          </div>
        </div>

        {/* Consent Text — Bilingual */}
        <div className="section bilingual">
          <div>
            <div className="section-title">ENGLISH</div>
            <p>I, the undersigned, hereby consent to the dental examination and any necessary dental treatment recommended by the treating dentist at {org?.name ?? "this clinic"}.</p>
            <p>I understand that dental procedures may involve risks including, but not limited to: pain, swelling, infection, bleeding, temporary or permanent numbness, injury to adjacent teeth, jaw soreness, and reactions to anaesthesia or medications.</p>
            <p>I confirm that I have disclosed all relevant medical conditions, allergies, and current medications to my dentist. I understand that withholding this information may affect my treatment.</p>
            <p>I acknowledge that the proposed treatment, including alternatives and the consequences of no treatment, has been explained to me in a language I understand.</p>
            <p>I consent to radiographs (X-rays) being taken as deemed necessary by the dentist for diagnosis and treatment planning.</p>
            <p>I understand that I have the right to refuse or withdraw consent at any time prior to the commencement of treatment.</p>
            <p>I authorise the clinic to retain and use my clinical records, radiographs, and photographs for treatment purposes.</p>
          </div>
          <div>
            <div className="section-title tamil">தமிழ்</div>
            <p className="tamil">நான், கீழே கையொப்பமிட்டவர், {org?.name ?? "இந்த மருத்துவமனையில்"} சிகிச்சை மருத்துவரால் பரிந்துரைக்கப்பட்ட பல் பரிசோதனை மற்றும் தேவையான பல் சிகிச்சைகளுக்கு சம்மதிக்கிறேன்.</p>
            <p className="tamil">பல் சிகிச்சைகளில் வலி, வீக்கம், தொற்று, இரத்தப்போக்கு, தற்காலிக அல்லது நிரந்தர உணர்வின்மை, அருகிலுள்ள பற்களுக்கு காயம், தாடை வலி மற்றும் மயக்க மருந்துகளுக்கான எதிர்வினைகள் போன்ற அபாயங்கள் இருக்கலாம் என்று புரிந்துகொள்கிறேன்.</p>
            <p className="tamil">என்னுடைய அனைத்து மருத்துவ நிலைகள், ஒவ்வாமைகள் மற்றும் தற்போதைய மருந்துகளை மருத்துவரிடம் தெரிவித்துள்ளேன் என்று உறுதிப்படுத்துகிறேன்.</p>
            <p className="tamil">முன்மொழியப்பட்ட சிகிச்சை, மாற்று விருப்பங்கள் மற்றும் சிகிச்சை இல்லாவிடில் ஏற்படும் விளைவுகள் எனக்கு புரியும் மொழியில் விளக்கப்பட்டுள்ளன என்று ஒப்புக்கொள்கிறேன்.</p>
            <p className="tamil">நோய் கண்டறிதல் மற்றும் சிகிச்சை திட்டமிடலுக்காக மருத்துவரால் தேவையென கருதப்பட்டால் X-ray எடுக்க சம்மதிக்கிறேன்.</p>
            <p className="tamil">சிகிச்சை தொடங்குவதற்கு முன்பு எந்த நேரத்திலும் என்னுடைய சம்மதத்தை மறுக்கும் அல்லது திரும்பப் பெறும் உரிமை எனக்கு உள்ளது என்று புரிந்துகொள்கிறேன்.</p>
            <p className="tamil">சிகிச்சை நோக்கங்களுக்காக என்னுடைய மருத்துவ பதிவுகள், X-ray மற்றும் புகைப்படங்களை மருத்துவமனை வைத்திருக்க மற்றும் பயன்படுத்த அனுமதிக்கிறேன்.</p>
          </div>
        </div>

        {/* Specific Procedure */}
        <div className="section">
          <div className="section-title">PROCEDURE DETAILS / சிகிச்சை விவரம்</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div className="field-line" />
              <div className="field-label">Procedure(s) consented to / சம்மதிக்கப்பட்ட சிகிச்சை(கள்)</div>
            </div>
            <div>
              <div className="field-line" />
              <div className="field-label">Tooth number(s) / பல் எண்(கள்)</div>
            </div>
            <div>
              <div className="field-line" style={{ minHeight: "48px" }} />
              <div className="field-label">Risks explained / விளக்கப்பட்ட அபாயங்கள்</div>
            </div>
            <div>
              <div className="field-line" style={{ minHeight: "48px" }} />
              <div className="field-label">Alternatives explained / மாற்று விருப்பங்கள் விளக்கம்</div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="section">
          <div className="section-title">SIGNATURES / கையொப்பங்கள்</div>
          <div className="sig-grid">
            <div className="sig-block">
              <div className="sig-line" />
              <div className="sig-label">Patient / Guardian Signature<br /><span className="tamil">நோயாளர் / பாதுகாவலர் கையொப்பம்</span></div>
            </div>
            <div className="sig-block">
              <div className="sig-line" />
              <div className="sig-label">Witness Signature<br /><span className="tamil">சாட்சி கையொப்பம்</span></div>
            </div>
            <div className="sig-block">
              <div className="sig-line" />
              <div className="sig-label">Print Name / Date<br /><span className="tamil">பெயர் / தேதி</span></div>
            </div>
            <div className="sig-block">
              <div className="sig-line" />
              <div className="sig-label">Treating Dentist Signature &amp; Stamp<br /><span className="tamil">மருத்துவர் கையொப்பம் &amp; முத்திரை</span></div>
              <div className="stamp-area">Stamp / முத்திரை</div>
            </div>
          </div>
        </div>

        <p style={{ fontSize: "10px", color: "#6b7280", textAlign: "center", marginTop: "24px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
          This consent form is valid for the treatment session indicated. A new consent must be obtained for each new procedure. / இந்த சம்மத படிவம் குறிப்பிட்ட சிகிச்சை அமர்வுக்கு மட்டுமே செல்லுபடியாகும்.
        </p>
      </div>
    </>
  );
}
