# Product Requirements Document (PRD)
## Dental Practice Management Application — Parkkal

**Version:** 1.0  
**Date:** 2026-05-30  
**Author:** Dental Practice Team  
**Status:** Draft

---

## 1. Executive Summary

Parkkal is a web-based Dental Practice Management Application designed to streamline day-to-day clinic operations for dental practices of all sizes. It covers patient registration, appointment scheduling, clinical charting, treatment planning, billing and invoicing, inventory management, staff management, and reporting — all in a single integrated platform.

---

## 2. Problem Statement

Dental clinics today face operational inefficiencies caused by:

- Paper-based or fragmented digital records
- No-show appointments and poor scheduling visibility
- Manual billing errors and delayed payments
- Difficulty tracking treatment history across visits
- Lack of actionable reporting for practice growth

Parkkal solves these by providing a unified, intuitive platform purpose-built for dental workflows.

---

## 3. Goals and Success Metrics

| Goal | Success Metric |
|------|---------------|
| Reduce appointment no-shows | ≥ 30% reduction via automated reminders |
| Cut billing errors | < 2% error rate on generated invoices |
| Faster patient check-in | Check-in time ≤ 2 minutes |
| Treatment plan adoption | ≥ 80% of plans documented digitally |
| Staff satisfaction | NPS ≥ 40 after 3 months |

---

## 4. Target Users

| Role | Description |
|------|-------------|
| **Dentist / Doctor** | Manages clinical notes, charting, treatment plans, prescriptions |
| **Receptionist / Front Desk** | Handles patient registration, scheduling, check-in/out |
| **Dental Assistant / Hygienist** | Assists with charting, procedure notes, sterilization logs |
| **Practice Manager / Admin** | Manages staff, billing oversight, reports, configuration |
| **Patient** | Self-service portal: view appointments, records, invoices |

---

## 5. Scope

### 5.1 In Scope (v1.0)

- Patient Management
- Appointment Scheduling & Calendar
- Clinical Charting (Dental Chart / Odontogram)
- Treatment Planning
- Billing & Invoicing
- Prescription Management
- Inventory & Supply Management
- Staff Management & Role-Based Access
- Notifications & Reminders
- Reporting & Analytics
- Patient Self-Service Portal

### 5.2 Out of Scope (v1.0)

- Teledentistry / video consultations
- Insurance claims EDI integration (planned v2.0)
- Multi-branch / enterprise features (planned v2.0)
- Mobile native apps (responsive web only in v1.0)
- Radiograph / DICOM viewer

---

## 6. Feature Requirements

---

### 6.1 Patient Management

#### 6.1.1 Patient Registration

**Description:** Create and maintain comprehensive patient profiles.

**Functional Requirements:**

- FR-PM-001: Register a new patient with the following mandatory fields:
  - Full name (first, last)
  - Date of birth
  - Gender
  - Mobile number (primary contact)
  - Email address
- FR-PM-002: Capture optional fields: address, blood group, emergency contact name and number, allergies, medical history notes, insurance details.
- FR-PM-003: Auto-generate a unique Patient ID (e.g., `PKL-00001`) on registration.
- FR-PM-004: Support photo upload for patient identification.
- FR-PM-005: Record consent forms with e-signature and timestamp.
- FR-PM-006: Track referral source (walk-in, referred by doctor, social media, etc.).
- FR-PM-007: Mark patients as Active, Inactive, or Deceased.
- FR-PM-008: Merge duplicate patient records with audit trail.
- FR-PM-009: Full-text search across name, phone, email, and Patient ID.
- FR-PM-010: Display patient's upcoming appointments, past visits, outstanding balance, and treatment history on the patient profile page.

**Non-Functional Requirements:**
- Patient search results must return within 500ms for databases up to 100,000 records.

---

### 6.2 Appointment Scheduling & Calendar

**Description:** Book, manage, and track appointments across providers and operatories.

**Functional Requirements:**

- FR-AS-001: Display a calendar view switchable between day, week, and month.
- FR-AS-002: Color-code appointments by status: Scheduled, Confirmed, Checked-In, In-Progress, Completed, Cancelled, No-Show.
- FR-AS-003: Book a new appointment with: patient, provider (dentist/hygienist), operatory (chair), date/time, duration, appointment type, and notes.
- FR-AS-004: Prevent double-booking of the same provider or operatory at the same time slot.
- FR-AS-005: Support recurring appointments (e.g., weekly cleaning every 6 months reminder).
- FR-AS-006: Allow drag-and-drop rescheduling of appointments on the calendar.
- FR-AS-007: Record cancellation reason when an appointment is cancelled.
- FR-AS-008: Send automated appointment reminders via SMS and/or email at configurable intervals (e.g., 48 hours before, 2 hours before).
- FR-AS-009: Provide a waitlist feature — automatically notify waitlisted patients when a slot opens.
- FR-AS-010: Allow patient self-booking via the patient portal within clinic-configured available hours.
- FR-AS-011: Display chair/operatory utilization view so clinic can identify open capacity.
- FR-AS-012: Log all changes to appointments with timestamps and the user who made the change.

---

### 6.3 Clinical Charting (Odontogram)

**Description:** Interactive dental chart to record tooth conditions, procedures, and clinical findings.

**Functional Requirements:**

- FR-CC-001: Display a full adult (32 teeth) and pediatric (20 teeth) odontogram, togglable per patient.
- FR-CC-002: Support FDI (ISO 3950) and Universal (ADA) tooth numbering systems, configurable per practice.
- FR-CC-003: Allow marking tooth conditions per surface (mesial, distal, occlusal, buccal, lingual):
  - Caries (existing)
  - Existing restoration (amalgam, composite, crown, bridge, implant, veneer)
  - Extraction indicated / extracted
  - Missing tooth
  - Root canal treated
  - Fractured tooth
  - Periapical abscess
  - Impacted tooth
- FR-CC-004: Distinguish between existing conditions (noted at visit) and planned/completed procedures using color coding.
- FR-CC-005: Record periodontal chart data: probing depth, bleeding on probing, recession, furcation involvement, and mobility for each tooth.
- FR-CC-006: Attach clinical notes per tooth and per visit.
- FR-CC-007: Capture SOAP notes (Subjective, Objective, Assessment, Plan) for each visit.
- FR-CC-008: Lock a completed visit note — only the treating doctor can unlock with a reason.
- FR-CC-009: Display a chronological timeline of all clinical notes for a patient.
- FR-CC-010: Allow attaching intraoral photos to clinical notes.

---

### 6.4 Treatment Planning

**Description:** Create and present multi-phase treatment plans to patients.

**Functional Requirements:**

- FR-TP-001: Create a treatment plan linked to a patient with one or more phases.
- FR-TP-002: Each phase contains: procedure name (linked to procedure catalog), tooth number, surface, fee, provider, and estimated duration.
- FR-TP-003: Link treatment plan items to the odontogram for visual reference.
- FR-TP-004: Calculate total plan cost and per-phase cost automatically.
- FR-TP-005: Generate a printable/downloadable treatment plan PDF for patient presentation.
- FR-TP-006: Track plan status per item: Proposed, Accepted, Completed, Declined, Deferred.
- FR-TP-007: Allow patient acceptance/decline with digital signature capture.
- FR-TP-008: Convert accepted treatment plan items into scheduled appointments in one click.
- FR-TP-009: Maintain history of all treatment plan versions (audit trail).
- FR-TP-010: Support alternative treatment options for the same diagnosis (e.g., crown vs. extraction).

---

### 6.5 Billing & Invoicing

**Description:** Generate invoices, accept payments, and manage financial records.

**Functional Requirements:**

- FR-BI-001: Auto-generate an invoice from completed appointment procedures.
- FR-BI-002: Itemize invoice by procedure: code, description, quantity, unit fee, discount, tax, and total.
- FR-BI-003: Apply discounts at line-item or invoice level (percentage or fixed amount).
- FR-BI-004: Record payments with: payment method (cash, card, UPI, insurance, EMI), amount, reference number, and date.
- FR-BI-005: Support partial payments — track outstanding balance per patient.
- FR-BI-006: Generate and send invoice PDF via email/WhatsApp.
- FR-BI-007: Record refunds with reason and update balance accordingly.
- FR-BI-008: Maintain a ledger of all financial transactions per patient.
- FR-BI-009: Support basic insurance claim recording: payer name, policy number, claim amount, claim status (pending, approved, rejected, paid).
- FR-BI-010: Generate daily, monthly, and custom-range financial summaries.
- FR-BI-011: Support configurable tax rates (GST, VAT, etc.) per procedure or globally.
- FR-BI-012: Void/cancel an invoice with a mandatory reason and audit entry.

---

### 6.6 Procedure Catalog

**Description:** Central catalog of all dental procedures with codes and fees.

**Functional Requirements:**

- FR-PC-001: Maintain a list of procedures with: code (ADA/CDT or custom), name, category, default fee, duration, and tax applicability.
- FR-PC-002: Support procedure categories: Preventive, Restorative, Endodontic, Periodontic, Prosthodontic, Oral Surgery, Orthodontic, Cosmetic, Diagnostic.
- FR-PC-003: Allow override of fee at the appointment/invoice level without changing the catalog.
- FR-PC-004: Bulk import/export procedures via CSV.
- FR-PC-005: Deactivate procedures to prevent new use while preserving historical records.

---

### 6.7 Prescription Management

**Description:** Create, manage, and print patient prescriptions.

**Functional Requirements:**

- FR-PR-001: Create a prescription linked to a patient and visit.
- FR-PR-002: Add medications with: drug name, dosage, form (tablet/syrup/gel), frequency, duration, and instructions.
- FR-PR-003: Maintain a drug master list; allow searching by generic or brand name.
- FR-PR-004: Generate a printable prescription with clinic letterhead, doctor details, and registration number.
- FR-PR-005: Store prescription history per patient and per visit.
- FR-PR-006: Flag known drug allergies from the patient profile when prescribing.

---

### 6.8 Inventory & Supply Management

**Description:** Track dental supplies, materials, and equipment.

**Functional Requirements:**

- FR-IN-001: Maintain an inventory catalog with: item name, category, SKU, unit, minimum stock level, and current quantity.
- FR-IN-002: Record stock-in entries: supplier, quantity, unit cost, expiry date (if applicable), and invoice reference.
- FR-IN-003: Record stock-out entries linked to a date and optionally to a procedure/patient.
- FR-IN-004: Alert when stock falls below the configured minimum level.
- FR-IN-005: Track expiry dates and alert 30 and 7 days before expiry.
- FR-IN-006: Generate stock valuation report (current quantity × unit cost).
- FR-IN-007: Maintain supplier list with contact details.
- FR-IN-008: Support multiple units of measure (box, piece, ml, kg).

---

### 6.9 Staff Management & Role-Based Access Control

**Description:** Manage clinic staff and control system access by role.

**Functional Requirements:**

- FR-SM-001: Create staff profiles with: name, role, specialization, contact, license number, joining date, and photo.
- FR-SM-002: Assign one or more roles from: Admin, Dentist, Hygienist, Dental Assistant, Receptionist, Billing Staff.
- FR-SM-003: Define role-based permissions at the module level (view, create, edit, delete).
- FR-SM-004: Manage staff working schedules — define working days, hours, and breaks per provider.
- FR-SM-005: Deactivate staff accounts without deleting historical data.
- FR-SM-006: Log all logins and critical actions (audit log) per staff member.
- FR-SM-007: Support password reset via email OTP.
- FR-SM-008: Track staff leave and mark providers as unavailable on specific dates.

**Default Role Permissions:**

| Module | Admin | Dentist | Hygienist | Receptionist | Billing |
|--------|-------|---------|-----------|--------------|---------|
| Patient Records | Full | Full | View+Notes | View+Register | View |
| Appointments | Full | Full | Own Schedule | Full | View |
| Clinical Chart | Full | Full | Full | None | None |
| Billing | Full | View | None | View | Full |
| Reports | Full | Own | None | None | Billing |
| Settings | Full | None | None | None | None |

---

### 6.10 Notifications & Reminders

**Description:** Automated and manual communications with patients and staff.

**Functional Requirements:**

- FR-NR-001: Send automated appointment reminders via SMS and email (configurable timing: 48h, 24h, 2h before).
- FR-NR-002: Send appointment confirmation immediately upon booking.
- FR-NR-003: Send post-visit feedback/review request after appointment completion.
- FR-NR-004: Recall notifications — alert patients due for their periodic checkup (e.g., 6-month cleaning recall).
- FR-NR-005: Birthday greetings — auto-send on patient's birthday.
- FR-NR-006: Outstanding balance reminder — notify patients with overdue balances.
- FR-NR-007: Inventory low-stock and expiry alerts to the admin/manager.
- FR-NR-008: All notification templates must be configurable (content, enable/disable).
- FR-NR-009: Maintain a log of all sent notifications with delivery status.
- FR-NR-010: Support WhatsApp notifications via API integration (optional, configurable).

---

### 6.11 Patient Self-Service Portal

**Description:** A web portal where patients can interact with their own records.

**Functional Requirements:**

- FR-PP-001: Patient login via mobile OTP or email/password.
- FR-PP-002: View upcoming and past appointments.
- FR-PP-003: Request a new appointment (clinic confirms).
- FR-PP-004: Cancel or reschedule an upcoming appointment (within clinic-set policy window).
- FR-PP-005: View and download invoices and payment receipts.
- FR-PP-006: View treatment history summary (non-clinical view — no detailed chart).
- FR-PP-007: View and download prescriptions.
- FR-PP-008: Update personal contact information (changes require staff approval).
- FR-PP-009: Submit a feedback/rating for a completed visit.
- FR-PP-010: Access FAQs and clinic contact information.

---

### 6.12 Reporting & Analytics

**Description:** Data-driven insights for practice management.

**Functional Requirements:**

- FR-RA-001: Daily Summary Report — appointments scheduled, completed, cancelled, and revenue collected.
- FR-RA-002: Revenue Report — breakdowns by period, procedure category, provider, and payment method.
- FR-RA-003: Appointment Analytics — utilization rate, no-show rate, cancellation rate.
- FR-RA-004: Patient Analytics — new vs. returning patients, retention rate, acquisition source.
- FR-RA-005: Outstanding Receivables Report — patients with pending balances, aging buckets (0-30, 31-60, 61-90, 90+ days).
- FR-RA-006: Provider Production Report — procedures and revenue per dentist.
- FR-RA-007: Inventory Report — current stock levels, consumption trends, low-stock items.
- FR-RA-008: Treatment Plan Report — acceptance rate, pending plan value.
- FR-RA-009: All reports must be exportable as CSV and PDF.
- FR-RA-010: Dashboard with KPI widgets: today's appointments, today's collections, active patients, outstanding balance.

---

### 6.13 System Configuration & Settings

**Functional Requirements:**

- FR-SC-001: Clinic profile: name, logo, address, contact, registration number, website.
- FR-SC-002: Configure working hours and days per clinic.
- FR-SC-003: Appointment slot duration defaults (10, 15, 20, 30, 45, 60 min).
- FR-SC-004: Configure tax rates and types (GST/VAT components).
- FR-SC-005: Set currency and locale.
- FR-SC-006: Manage operatories / dental chairs (name, color label).
- FR-SC-007: Configure notification templates and trigger conditions.
- FR-SC-008: Manage procedure categories and payment methods.
- FR-SC-009: Configure data backup schedule and retention policy.
- FR-SC-010: View system audit logs.

---

## 7. Technical Requirements

### 7.1 Technology Stack (Recommended)

| Layer | Technology |
|-------|-----------|
| Frontend | React 18+ with TypeScript |
| UI Components | Tailwind CSS + shadcn/ui |
| State Management | Zustand or React Query |
| Backend | Node.js with Express or NestJS |
| Database | PostgreSQL (primary) |
| ORM | Prisma |
| Authentication | JWT + refresh tokens, bcrypt for passwords |
| File Storage | AWS S3 or local MinIO |
| Notifications | Twilio (SMS), SendGrid (Email), WhatsApp Business API |
| PDF Generation | Puppeteer or React-PDF |
| Deployment | Docker + Docker Compose; deployable on any VPS |

### 7.2 Non-Functional Requirements

| Requirement | Specification |
|-------------|--------------|
| Performance | Page load < 2s; API response < 500ms (p95) |
| Availability | 99.5% uptime (excluding scheduled maintenance) |
| Scalability | Support up to 10 providers, 50,000 patients in v1.0 |
| Security | OWASP Top 10 compliance; data encrypted at rest and in transit (TLS 1.2+) |
| Browser Support | Chrome, Firefox, Edge, Safari — latest 2 major versions |
| Responsive Design | Usable on desktop (1280px+) and tablet (768px+) |
| Data Backup | Daily automated backups; point-in-time recovery for 30 days |
| Accessibility | WCAG 2.1 Level AA compliance |
| Audit Trail | All create/update/delete operations logged with user ID and timestamp |
| Session Management | Auto-logout after 30 minutes of inactivity (configurable) |

### 7.3 Security Requirements

- SR-001: All passwords hashed with bcrypt (min cost factor 12).
- SR-002: All API endpoints protected with role-based middleware.
- SR-003: Patient data access logged for compliance.
- SR-004: HTTPS enforced; no sensitive data in URL query parameters.
- SR-005: SQL injection and XSS prevention via parameterized queries and output encoding.
- SR-006: Rate limiting on login and OTP endpoints.
- SR-007: File upload validation: allowed types, max size (10 MB), malware scan on upload.
- SR-008: Sensitive fields (PAN, Aadhaar where collected) stored encrypted.

---

## 8. Data Model Overview

### Core Entities

```
Patient
  id, patient_number, first_name, last_name, dob, gender, phone, email,
  blood_group, allergies, medical_history, status, photo_url, created_at

Appointment
  id, patient_id, provider_id, operatory_id, appointment_type_id,
  start_time, end_time, status, notes, created_by, created_at

ClinicalNote (Visit)
  id, patient_id, appointment_id, provider_id, chief_complaint,
  examination, assessment, plan, created_at, locked_at, locked_by

ToothChart
  id, patient_id, tooth_number, numbering_system, surface, condition,
  status (existing/planned/completed), noted_on_visit_id

TreatmentPlan
  id, patient_id, provider_id, title, status, total_fee, created_at

TreatmentPlanItem
  id, plan_id, procedure_id, tooth_number, surface, fee, status,
  appointment_id (when scheduled)

Invoice
  id, patient_id, appointment_id, invoice_number, date, subtotal,
  discount, tax, total, status (draft/sent/partially_paid/paid/void)

InvoiceItem
  id, invoice_id, procedure_id, description, quantity, unit_fee,
  discount, tax, total

Payment
  id, invoice_id, patient_id, amount, method, reference, date, notes

Staff
  id, name, role[], specialization, phone, email, license_number,
  schedule, status

InventoryItem
  id, name, category, sku, unit, min_stock, current_qty, expiry_date

Prescription
  id, patient_id, visit_id, provider_id, date, medications (JSON)
```

---

## 9. User Interface Requirements

### 9.1 Navigation Structure

```
Sidebar Navigation:
├── Dashboard
├── Patients
│   ├── Patient List
│   └── New Patient
├── Appointments
│   ├── Calendar
│   └── Appointment List
├── Clinical
│   ├── Dental Chart
│   ├── Clinical Notes
│   └── Prescriptions
├── Treatment Plans
├── Billing
│   ├── Invoices
│   ├── Payments
│   └── Outstanding
├── Inventory
├── Staff
├── Reports
└── Settings
```

### 9.2 Key UI Screens

1. **Dashboard** — KPI cards, today's appointment timeline, pending tasks (treatment plans, outstanding payments)
2. **Patient Profile** — Tabbed view: Overview, Appointments, Clinical History, Treatment Plans, Billing, Documents
3. **Appointment Calendar** — Multi-column daily view by provider/operatory; color-coded by status
4. **Dental Chart** — Interactive SVG odontogram with surface-level click targets; split view with clinical notes
5. **Invoice** — Clean, printable layout with itemized procedures and payment history

---

## 10. Milestones & Phased Delivery

### Phase 1 — Core Operations (Weeks 1–8)
- Patient management (registration, search, profile)
- Appointment scheduling (calendar, booking, reminders)
- Basic clinical notes (SOAP notes)
- User auth and role-based access

### Phase 2 — Clinical Depth (Weeks 9–14)
- Full dental odontogram / charting
- Treatment planning
- Prescription management
- Periodontal charting

### Phase 3 — Billing & Inventory (Weeks 15–20)
- Invoicing and payments
- Insurance claim recording
- Inventory and supply management
- Procedure catalog management

### Phase 4 — Patient Portal & Analytics (Weeks 21–26)
- Patient self-service portal
- Notification system (SMS, email, WhatsApp)
- Reporting and analytics dashboard
- Recall management

---

## 11. Assumptions & Constraints

- Single-clinic deployment in v1.0 (no multi-branch).
- Regulatory compliance is assumed for the Indian market (DISHA / health data privacy).
- SMS/email costs are borne by the clinic operator via their own API credentials.
- DICOM / X-ray viewer is out of scope; images can be uploaded as JPEG/PNG attachments only.
- The application will be deployed as a self-hosted solution or on a managed cloud VPS.

---

## 12. Open Questions

1. Should the v1.0 billing module support EMI/installment plan tracking?
2. Is WhatsApp notification integration required at launch or a fast-follow?
3. Should the patient portal be a separate subdomain or an integrated route?
4. Is there a preference for a specific SMS/email provider (Twilio, Exotel, MSG91)?
5. Are there existing procedure codes / fee schedules to import at launch?
6. What insurance providers need to be supported for claim tracking?

---

*End of PRD — Parkkal Dental Management Application v1.0*
