# Parkkal Dental Clinic — Product Requirements Document

**Product:** Parkkal HMS (Hospital/Clinic Management System)
**Platform:** Web — app.parkkal.com
**Stack:** Next.js 15, Drizzle ORM, Cloudflare Workers + D1
**Phase:** 1 Complete
**Last Updated:** May 2026

---

## Vision

A modern, multi-tenant SaaS clinic management platform purpose-built for dental practices. Any clinic can onboard, and staff log in to see only their clinic's data. Doctors can work across multiple clinics. Everything from patient registration to billing and payroll runs in one place — accessible from any device, anywhere.

---

## Phase 1 — Completed Features

---

### Epic 1: Multi-Tenant Organization Platform

#### US-001 — Organization Isolation
**As an** administrator,
**I want** each clinic to operate as an isolated tenant,
**So that** Parkkal staff and XMed staff never see each other's data.

**Acceptance Criteria:**
- [x] Each org has: id, name, slug, address, phone, email, logo
- [x] All patients, visits, billing, staff scoped to `organizationId`
- [x] No data leaks between orgs — every API query filters by session `orgId`
- [x] Three test orgs seeded: Parkkal Dental, XMed Hospital, DrSmile Dental

#### US-002 — Multi-Org Login Flow
**As a** user who works at multiple clinics,
**I want** to choose which clinic I'm logging into,
**So that** I can switch context without separate accounts.

**Acceptance Criteria:**
- [x] Login with email + password
- [x] 1 org → auto-enter dashboard
- [x] Multiple orgs → show org selector screen with name, address, role badge
- [x] Session cookie (`pkd_org_session`) carries: userId, orgId, orgName, orgSlug, role
- [x] Logout clears both session cookies
- [x] doctor@parkkal.com shared across Parkkal + XMed → sees org selector

---

### Epic 2: Patient Management

#### US-003 — Patient Registration
**As a** receptionist,
**I want** to register a new patient with complete demographic details,
**So that** their record is available for all future visits.

**Acceptance Criteria:**
- [x] Fields: Full Name, Phone, Email, DOB, Gender, Blood Group, Medical History
- [x] Blood group: complete ABO+Rh list (O+/−, A+/−, B+/−, AB+/−, A1/A2/A1B/A2B, Bombay Oh, Unknown)
- [x] Cascading address: Country → State → District → City → Pincode + Street
- [x] India pincode lookup: 6 digits → auto-fills State + District (India Post API, 600ms debounce)
- [x] Emergency Contact: required — blocks save if missing
- [x] PAN + Aadhaar: optional, yellow warning banner if missing
- [x] Auto-generates org-scoped patient code (PKL-0001)
- [x] Patient linked to org via `organization_patients`

#### US-004 — Patient List & Search
**Acceptance Criteria:**
- [x] Table: Patient Code, Name, Phone, Age, Actions
- [x] Search by name, phone, or patient code
- [x] Only shows patients of current org

#### US-005 — Patient Financial Summary
**Acceptance Criteria:**
- [x] Banner: Total Billed | Total Paid | Outstanding | Visit Count | Last Visit
- [x] "New Visit" quick action button
- [x] Warning if no emergency contact or missing documents

---

### Epic 3: Visit & Clinical Records

#### US-006 — Create Visit
**As a** doctor or receptionist,
**I want** to open a new visit for a patient,
**So that** all clinical work is recorded under a unique visit record.

**Acceptance Criteria:**
- [x] Select patient (searchable), doctor, date
- [x] Chief Complaint + Doctor Notes
- [x] Auto-generates visit code: `VIS-YYYYMMDD-XXXX`
- [x] Visit scoped to current org

#### US-007 — Prescription / Treatment Items
**Acceptance Criteria:**
- [x] Add items: Name, Category, Tooth #, Qty, Unit Price → Amount auto-calculated
- [x] Multiple items per visit; visit total auto-updates
- [x] Items appear in Treatments summary view linked to visit code

#### US-008 — Payment Recording
**Acceptance Criteria:**
- [x] Add payment: Amount, Method (Cash/Card/UPI/Bank Transfer), Reference, Notes
- [x] Cannot exceed outstanding balance (validated)
- [x] Visit auto-completes when fully paid
- [x] Payment history table per visit

#### US-009 — File Attachments
**Acceptance Criteria:**
- [x] Upload per visit: XRay, Prescription, Doctor Note, Lab Report, Other
- [x] Stored at `/public/uploads/[patientId]/`
- [x] Delete removes file + DB record

#### US-010 — Patient Visit History (in-visit)
**Acceptance Criteria:**
- [x] Tab on visit detail showing all past visits for same patient
- [x] Clickable — navigates to any visit

#### US-011 — Print Visit Receipt
**Acceptance Criteria:**
- [x] Clinic header, visit info, itemised prescription table
- [x] Payment summary: Total, Paid, Balance Due
- [x] Payment history, signature lines
- [x] `window.print()` with clean print CSS (no sidebar/nav)

---

### Epic 4: Billing

#### US-012 — Billing Dashboard
**Acceptance Criteria:**
- [x] Shows all visits: Visit Code, Patient, Doctor, Date, Total, Paid, Balance Due, Status
- [x] Status badges: OPEN (blue), COMPLETED (green), CANCELLED (red)
- [x] "Mark Paid" clears balance with a full cash payment record

---

### Epic 5: Staff & HR Management

#### US-013 — Staff Registration
**Acceptance Criteria:**
- [x] Add existing user by email OR create new user
- [x] Fields: Name, Email, Phone, DOB, Gender, Blood Group, Cascading Address
- [x] Role: Admin, Doctor, Nurse, Receptionist, Attendant, Helper
- [x] Salary type auto-set: Doctor → Per Appointment; others → Fixed Monthly
- [x] Emergency contact required; PAN + Aadhaar optional with tooltip

#### US-014 — Salary Management
**Acceptance Criteria:**
- [x] Generate monthly salary records for all active staff
- [x] Doctor: appointment count × per-appointment rate
- [x] Fixed: flat monthly amount
- [x] Mark individual records as Paid
- [x] Summary: Total Payroll | Paid | Outstanding

---

### Epic 6: Role & Permission Management

#### US-015 — Custom Role Management
**Acceptance Criteria:**
- [x] Role cards: name, color, description, permission tags, member count
- [x] System roles cannot be deleted
- [x] Create custom role: name, description, color, permissions checklist
- [x] Permissions grouped: Patients | Visits | Billing | Staff | Salary | Roles | Settings | Reports
- [x] Edit role: shows "This will affect X members" warning
- [x] Delete with members: migration modal → pick target role → migrate → delete
- [x] API returns 409 with user list if role has members

---

### Epic 7: Organisation Settings

#### US-016 — Organisation Profile
**Acceptance Criteria:**
- [x] Edit: Name, Phone, Email, Cascading Address
- [x] Persists via PATCH /api/org/profile

---

### Epic 8: Identity & Address Standards

#### US-017 — Standardised Address
**Acceptance Criteria:**
- [x] AddressForm used on: Patient Registration, Add Staff, Org Settings
- [x] Country dropdown: 60+ countries, India default
- [x] India: all 28 states + 8 UTs (hardcoded)
- [x] Districts: full list for 11 major states (Tamil Nadu all 38)
- [x] Pincode → auto-fill State + District via India Post API
- [x] Non-India: free text fields

#### US-018 — Blood Group on All Identity Forms
**Acceptance Criteria:**
- [x] Present on Patient Registration and Add Staff
- [x] Full list including rare types

---

## Phase 1 Technical Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS |
| Auth | JWT (jose), httpOnly cookies, org-scoped sessions |
| Database (local dev) | SQLite via @libsql/client + Drizzle ORM |
| Database (production) | Cloudflare D1 + Drizzle ORM |
| Deployment | Cloudflare Workers via @opennextjs/cloudflare |
| File Storage | Local filesystem (R2 in Phase 2) |
| Pincode API | api.postalpincode.in (India Post, free, no auth) |

**16 database tables:** organizations, users, org_roles, organization_members, emergency_contacts, patients, organization_patients, appointments, treatments, invoices, invoice_treatments, visits, visit_items, payments, attachments, salary_records

**35 API routes** across: Auth, Patients, Visits, Appointments, Treatments, Invoices, Org, Dashboard, Address, Emergency Contacts, Users

---

## Phase 2 — Plan

### Theme: Clinical Excellence & Patient Experience

---

### P2-F1: Appointment Scheduling (Calendar)
**Priority: High**

**User Stories:**
- Receptionist views doctor availability by day/week and books a slot
- Patient gets WhatsApp/SMS confirmation on booking
- Doctor sees their schedule for the day on login
- Appointment auto-converts to a Visit when patient checks in
- No-show and cancellation tracked with reason

**Scope:**
- Week/month calendar view with doctor slots
- Availability configuration per doctor (working hours, days off)
- Appointment → Visit conversion button
- Reminder jobs (24h before via MSG91/Twilio)

---

### P2-F2: Interactive Dental Chart (Odontogram)
**Priority: High**

**User Stories:**
- Doctor clicks on a tooth and records: Decayed, Filled, Crowned, Missing, Implant, RCT
- Chart is saved per visit and viewable historically
- Printed receipt includes the odontogram
- Child patients show 20-tooth primary chart; adults show 32-tooth chart

**Scope:**
- SVG-based interactive tooth chart component
- Tooth status stored in `visit_teeth` table
- Print-ready rendering
- Historical comparison (visit A vs visit B)

---

### P2-F3: Patient Portal
**Priority: High**

**User Stories:**
- Patient receives a login link via SMS after registration
- Patient views: upcoming appointments, visit history, bills, prescriptions
- Patient downloads receipts as PDF
- Patient requests an appointment online

**Scope:**
- Separate auth flow for patients (magic link or PIN)
- Read-only portal at `/patient/[token]/`
- No access to other patients' data
- Mobile-optimised layout

---

### P2-F4: PDF Generation & Download
**Priority: High**

**User Stories:**
- Receptionist clicks "Download PDF" on a visit receipt
- PDF stored in R2 and shareable via WhatsApp link
- Doctor downloads salary slip for a month

**Scope:**
- Server-side PDF using `@react-pdf/renderer`
- Stored in Cloudflare R2 with signed URL
- PDF types: Visit Receipt, Prescription, Salary Slip
- WhatsApp share button with pre-filled message

---

### P2-F5: Cloudflare R2 File Storage
**Priority: High**

**User Stories:**
- XRay images uploaded in-app and stored securely in the cloud
- Files accessible via time-limited signed URLs
- No file loss if server restarts

**Scope:**
- Replace `/public/uploads/` with R2 bucket
- Files organized: `/{orgId}/{patientId}/{visitId}/{uuid.ext}`
- 10MB per file limit
- Image compression before upload

---

### P2-F6: WhatsApp & SMS Notifications
**Priority: Medium**

**Trigger events → notifications:**
- Appointment booked → confirmation to patient
- 24h before appointment → reminder
- Payment recorded → receipt summary
- Patient birthday → greeting

**Scope:**
- MSG91 or Twilio WhatsApp Business API
- Template messages pre-approved
- Notification log per patient
- On/off toggle per org

---

### P2-F7: Financial Reports & Analytics
**Priority: Medium**

**User Stories:**
- Admin views revenue by day/week/month
- Admin sees doctor-wise revenue breakdown
- Billing sees outstanding dues aging (30/60/90 days)
- Admin exports report to CSV

**Scope:**
- Reports page with date range pickers
- Charts: revenue trend, treatment category split
- Tables: doctor revenue, patient dues aging
- CSV export
- Dashboard widgets updated with chart components

---

### P2-F8: Inventory & Supplies
**Priority: Medium**

**User Stories:**
- Admin adds stock items (gloves, syringes, impression material)
- System alerts when stock falls below minimum
- Consumption auto-deducted when procedure is recorded

**Scope:**
- `inventory_items` and `stock_transactions` tables
- Low-stock alert banner on dashboard
- Link consumption to visit items by category
- Monthly purchase order generation

---

## Phase 3 — Future Vision

| Feature | Description |
|---|---|
| AI Diagnosis Assist | Claude API suggests diagnosis from chief complaint + history |
| Insurance Claims | NHCX / Ayushman Bharat integration |
| Telemedicine | Video consultation booking and recording |
| Mobile App | React Native for iOS/Android (doctors + patients) |
| Multi-Branch | One org, multiple clinic locations, central admin |
| Lab Integration | Track crown/denture/ortho lab work status |
| HL7/FHIR | Health data interoperability standard |
| Patient Reviews | Post-visit feedback, Google review automation |

---

## Appendix: Test Credentials

| Organization | Email | Password | Role |
|---|---|---|---|
| Parkkal Dental Clinic | admin@parkkal.com | Admin@123 | Admin |
| Parkkal Dental Clinic | doctor@parkkal.com | Doctor@123 | Doctor |
| Parkkal Dental Clinic | reception@parkkal.com | Recep@123 | Receptionist |
| XMed Hospital | admin@xmed.com | Admin@123 | Admin |
| XMed Hospital | doctor@parkkal.com | Doctor@123 | Doctor (shared) |
| DrSmile Dental | admin@drsmile.com | Admin@123 | Admin |
| DrSmile Dental | nurse@drsmile.com | Nurse@123 | Nurse |

*doctor@parkkal.com belongs to both Parkkal + XMed → login shows org selector*

---

*Repository: github.com/prasathchan/parkkal | Branch: develop*
