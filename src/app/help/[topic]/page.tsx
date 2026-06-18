import { notFound } from "next/navigation";
import Link from "next/link";

// ─── Content ──────────────────────────────────────────────────────────────────

interface Section {
  heading: string;
  body: string[];
}

interface Article {
  title: string;
  intro: string;
  sections: Section[];
  relatedLinks?: { href: string; label: string }[];
}

const articles: Record<string, Article> = {
  "treatment-plans": {
    title: "Treatment Plans",
    intro:
      "Treatment plans let you track multi-session procedures (root canal, braces, implants) from start to finish. Each plan lives on the patient profile and can be linked to multiple visits over time.",
    sections: [
      {
        heading: "Creating a treatment plan",
        body: [
          "Go to Treatments in the sidebar and click 'New Treatment Plan', or open a patient's profile and click 'New Plan' from the Treatments tab.",
          "Fill in the procedure description, affected tooth numbers (FDI notation), estimated cost, and planned number of sessions.",
          "The plan starts in 'Planned' status. It moves to 'In Progress' once linked to a visit, and 'Completed' when you mark it done.",
        ],
      },
      {
        heading: "Linking a plan to a visit",
        body: [
          "Inside a visit, open the Treatment Plan tab and click 'Link Treatment Plan'.",
          "Choose 'Link Only' to record the association without adding a bill item. This is useful when the patient is paying in instalments.",
          "Choose 'Link & Add to Bill' to add the outstanding treatment balance as a line item on the current visit's bill.",
        ],
      },
      {
        heading: "Consent management",
        body: [
          "Each treatment plan requires a signed consent form before billing is enabled. Upload a scanned or photographed copy from the plan's Consent section.",
          "If a physical form isn't available (emergency situation), an admin or doctor can apply Emergency Override with a written reason. This is permanently logged in the audit trail and all admins are notified by email.",
          "Consent status values: Pending → Uploaded → Verified → Billing unlocked.",
        ],
      },
      {
        heading: "Tracking payments",
        body: [
          "The progress ring next to each plan shows what percentage of the total cost has been paid. Hover over it to see the exact amounts.",
          "Payments are linked to treatments through the visit bill. Each visit where a treatment is billed contributes to the running total.",
        ],
      },
    ],
    relatedLinks: [
      { href: "/help/consent-management", label: "Consent management" },
      { href: "/help/billing", label: "Billing and payments" },
    ],
  },

  "consent-management": {
    title: "Consent Management",
    intro:
      "Parkkal enforces consent capture for every treatment plan as required by medical practice standards and the Digital Personal Data Protection Act 2023 (DPDP). Billing for a treatment is blocked until valid consent is on record.",
    sections: [
      {
        heading: "Consent status flow",
        body: [
          "Pending: No form uploaded. Billing is blocked.",
          "Uploaded: A form has been attached but not yet reviewed by an admin or verifying doctor.",
          "Verified: An admin has confirmed the form is valid. Billing is unlocked.",
          "Emergency Override: A doctor bypassed the requirement with a written reason. Billing is unlocked, all admins are notified, and the event is recorded in the audit log with HIGH severity.",
          "Rejected: The uploaded form was invalid. A new form must be uploaded.",
        ],
      },
      {
        heading: "Uploading a consent form",
        body: [
          "Inside a treatment plan, scroll to the Consent section and click 'Upload Consent'.",
          "Accepted formats: JPEG, PNG, WebP, PDF. Maximum size: 10 MB.",
          "The file is stored securely in Cloudflare R2 object storage and never exposed publicly.",
        ],
      },
      {
        heading: "Emergency Override",
        body: [
          "Use this only when a signed form genuinely cannot be obtained before treatment (unconscious patient, emergency extraction, etc.).",
          "You must enter a written reason of at least 5 characters. This reason is stored permanently and cannot be edited or deleted.",
          "All admin users receive an email notification immediately. The event appears in Settings → Audit Log marked as HIGH severity.",
        ],
      },
      {
        heading: "Patient data consent (DPDP)",
        body: [
          "When registering a new patient, staff must check the 'Patient has given data processing consent' checkbox. This records the timestamp and IP address as required by DPDP Article 5.",
          "Patients have the right to withdraw consent at any time (DPDP Article 13). An admin can trigger this from the patient profile. The clinical data remains until separately erased.",
          "To fully erase a patient's data (right of erasure), use the 'Erase Data' option on the patient profile. This is irreversible.",
        ],
      },
    ],
    relatedLinks: [
      { href: "/help/treatment-plans", label: "Treatment plans" },
      { href: "/help/billing", label: "Billing and payments" },
    ],
  },

  "billing": {
    title: "Billing and Payments",
    intro:
      "Parkkal tracks all revenue at the visit level. Each visit has a bill (line items) and a payment ledger. You can collect payments by visit, by treatment plan, or in advance.",
    sections: [
      {
        heading: "Recording a payment",
        body: [
          "The fastest way: open a visit, go to the Items tab, and use the Quick Pay row at the bottom. Enter the amount, choose Cash / UPI / Card / Bank Transfer, and click Record Payment.",
          "For more control (advance payments, treatment-attributed payments), use the Payments tab.",
          "Accepted methods: Cash, UPI, Card (debit/credit), Bank Transfer. Reference numbers are optional but recommended for UPI and bank transfers.",
        ],
      },
      {
        heading: "Bill items",
        body: [
          "Add line items for any procedure, consultation, medicine, X-ray, or other service. Each item has a name, category, quantity, and unit price.",
          "Linking a treatment plan item shows the treatment progress ring and tracks cumulative payments toward that plan's total cost.",
          "Items are saved immediately — there is no 'draft' state. Delete an item if it was added in error.",
        ],
      },
      {
        heading: "Printing a receipt",
        body: [
          "After recording at least one payment, a 'Print Receipt' button appears on the Payments tab.",
          "The receipt includes: clinic name and logo, patient details, itemised bill, payment history, and outstanding balance.",
          "Receipts are generated server-side and open in a new tab, ready for the browser's print dialogue.",
        ],
      },
      {
        heading: "GST / Invoices",
        body: [
          "If your clinic is GST-registered, enable GST in Settings → Clinic Details. GST is applied at the invoice level (not visit level).",
          "Generate a formal GST invoice from the Invoices section. The invoice includes CGST/SGST (or IGST for inter-state) calculated from your registered rates.",
          "SAC code 999312 is pre-filled for dental services.",
        ],
      },
      {
        heading: "Billing status",
        body: [
          "UNBILLED: Visit has no items or payments yet.",
          "OPEN: Items added but not fully paid.",
          "PARTIAL: Some payment received, balance outstanding.",
          "PAID: Total items amount equals total payments.",
          "Billing status is calculated automatically and cannot be manually overridden.",
        ],
      },
    ],
    relatedLinks: [
      { href: "/help/treatment-plans", label: "Treatment plans" },
      { href: "/help/void-payments", label: "Voiding payments" },
      { href: "/help/reports", label: "Reports and analytics" },
    ],
  },

  "recalls": {
    title: "Recalls",
    intro:
      "Recalls are scheduled follow-up reminders for patients. When you complete a visit and set a recall date, Parkkal creates a recall record and tracks whether the patient has booked their follow-up appointment.",
    sections: [
      {
        heading: "Setting a recall on a visit",
        body: [
          "Inside a visit, scroll to the Recall section in the visit header card and click 'Set recall'.",
          "Enter the recall date (the date by which the patient should return) and an optional note ('6-month checkup', 'review root canal', etc.).",
          "The recall appears in the Recalls list immediately.",
        ],
      },
      {
        heading: "Managing the recalls list",
        body: [
          "The Recalls page shows all open recalls, colour-coded by urgency: overdue recalls are highlighted in red.",
          "Status values: Not Booked → Booked → Completed.",
          "Use the 'Book Now' button to pre-fill the New Appointment form with the patient details and recall note.",
        ],
      },
      {
        heading: "Auto-completion",
        body: [
          "When an appointment that was booked from a recall is marked Completed, the corresponding recall is automatically updated to Completed status.",
          "You can also manually mark a recall Completed if the patient attended at a different clinic or their condition resolved.",
        ],
      },
    ],
    relatedLinks: [
      { href: "/help/billing", label: "Billing and payments" },
      { href: "/help/reports", label: "Reports and analytics" },
    ],
  },

  "void-payments": {
    title: "Voiding Payments",
    intro:
      "Voiding cancels a recorded payment without deleting it, preserving the full audit trail. Use it when a payment was entered in error, a cheque bounced, or a refund has been issued.",
    sections: [
      {
        heading: "Who can void a payment?",
        body: [
          "Only users with the billing.override permission (typically Admin role) can void payments.",
          "If you don't see the Void button on a payment row, your role does not have this permission. Contact your admin.",
        ],
      },
      {
        heading: "How to void a payment",
        body: [
          "Open the visit, go to the Payments tab, and click 'Void' next to the payment.",
          "Enter a reason for the void (required). This reason is stored permanently and appears in the payment row.",
          "Click 'Confirm Void'. The payment row will be greyed out with a 'Voided' label, and the visit's balance due will be recalculated automatically.",
        ],
      },
      {
        heading: "What happens after voiding?",
        body: [
          "The voided payment remains visible in the ledger but is excluded from all balance calculations.",
          "The 'Print Receipt' button only includes non-voided payments.",
          "The void action and reason are logged in the audit trail (Settings → Audit Log).",
          "Voiding cannot be undone — if the patient resubmits the payment, record it as a new payment entry.",
        ],
      },
    ],
    relatedLinks: [
      { href: "/help/billing", label: "Billing and payments" },
      { href: "/help/treatment-plans", label: "Treatment plans" },
    ],
  },

  "reports": {
    title: "Reports and Analytics",
    intro:
      "The Reports page (Admin and Manager roles only) gives you a clinic-wide view of revenue, patient activity, and outstanding balances. All figures are filterable by date range and branch.",
    sections: [
      {
        heading: "Revenue overview",
        body: [
          "Total Revenue: sum of all payments received in the period.",
          "Pending Amount: sum of outstanding balances on open visits.",
          "New Patients: unique patients who had their first visit in the period.",
          "Completed Visits: visits marked Completed in the period.",
        ],
      },
      {
        heading: "Insight cards",
        body: [
          "Missed revenue from no-shows: the total estimated value of appointments that ended as No-Show in the period.",
          "Outstanding treatment balance: the total amount still owed across all active treatment plans.",
          "Top 5 patients by outstanding balance: useful for proactive follow-up calls.",
        ],
      },
      {
        heading: "Outstanding balance aging",
        body: [
          "Groups unpaid visit balances by age: 0–30 days, 31–60 days, 61–90 days, 90+ days.",
          "Longer-aged balances indicate patients who may need a payment reminder or a payment plan.",
        ],
      },
      {
        heading: "Branch filtering",
        body: [
          "If your clinic has multiple branches, use the Location dropdown to view figures for a single branch or all branches combined.",
          "Exported CSV files include a Location column so you can analyse per-branch performance in Excel.",
        ],
      },
    ],
    relatedLinks: [
      { href: "/help/billing", label: "Billing and payments" },
      { href: "/help/recalls", label: "Recalls" },
    ],
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return Object.keys(articles).map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const article = articles[topic];
  if (!article) return { title: "Not Found" };
  return { title: `${article.title} — Parkkal Help` };
}

export default async function HelpTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const article = articles[topic];
  if (!article) notFound();

  const allTopics = Object.entries(articles).map(([slug, a]) => ({ slug, title: a.title }));

  return (
    <div className="min-h-screen bg-pk-surface-sunken">
      {/* Top nav */}
      <header className="border-b border-pk-border bg-pk-surface px-6 py-3.5 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-pk-teal-600 hover:underline font-medium">
          ← Dashboard
        </Link>
        <span className="text-pk-border-strong">|</span>
        <span className="text-sm font-semibold text-pk-text">Parkkal Help</span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 flex gap-10">
        {/* Sidebar nav */}
        <nav className="w-48 shrink-0 hidden md:block">
          <p className="text-xs font-semibold text-pk-text-muted uppercase tracking-wider mb-3">Topics</p>
          <ul className="space-y-1">
            {allTopics.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/help/${t.slug}`}
                  className={`block text-sm px-3 py-1.5 rounded-pk-sm transition ${
                    t.slug === topic
                      ? "bg-pk-teal-600 text-white font-medium"
                      : "text-pk-text-secondary hover:bg-pk-surface-raised"
                  }`}
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <article className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-pk-text mb-2">{article.title}</h1>
          <p className="text-pk-text-secondary text-base mb-8 leading-relaxed">{article.intro}</p>

          <div className="space-y-8">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-base font-semibold text-pk-text mb-3">{section.heading}</h2>
                <ul className="space-y-2">
                  {section.body.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-pk-text-secondary leading-relaxed">
                      <span className="text-pk-teal-600 mt-1 shrink-0">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {article.relatedLinks && article.relatedLinks.length > 0 && (
            <div className="mt-10 pt-6 border-t border-pk-border">
              <p className="text-sm font-semibold text-pk-text-muted mb-3">Related topics</p>
              <div className="flex flex-wrap gap-2">
                {article.relatedLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center gap-1 text-sm text-pk-teal-600 border border-pk-teal-200 px-3 py-1.5 rounded-full hover:bg-pk-teal-50 transition"
                  >
                    {l.label} →
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
