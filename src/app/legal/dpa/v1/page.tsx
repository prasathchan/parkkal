import Link from "next/link";

export const metadata = { title: "Data Processing Agreement v1 — Parkkal" };

export default function DpaV1Page() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <nav className="text-sm text-slate-500 mb-8">
          <Link href="/dashboard" className="hover:text-slate-700">Dashboard</Link>
          <span className="mx-2">/</span>
          <span>Data Processing Agreement</span>
        </nav>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Data Processing Agreement</h1>
        <p className="text-sm text-slate-500 mb-8">Version 1 &mdash; Effective 1 June 2025</p>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">1. Parties</h2>
            <p className="text-slate-600">
              This Data Processing Agreement (&ldquo;DPA&rdquo;) is entered into between the dental clinic operating
              a Parkkal account (&ldquo;Data Fiduciary&rdquo; or &ldquo;Clinic&rdquo;) and Parkkal
              (&ldquo;Data Processor&rdquo;), collectively &ldquo;the Parties.&rdquo;
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">2. Scope and Purpose</h2>
            <p className="text-slate-600">
              Parkkal processes personal data of the Clinic&rsquo;s patients solely to provide the dental
              clinic management services described in the Parkkal Terms of Service. Processing includes
              storage, retrieval, display, and deletion of patient records, visit histories, prescriptions,
              invoices, and related clinical data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">3. Obligations of the Data Fiduciary (Clinic)</h2>
            <ul className="list-disc pl-5 text-slate-600 space-y-1">
              <li>Obtain free, specific, informed, and unambiguous consent from patients before collecting their personal data.</li>
              <li>Inform patients of their rights under the Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;).</li>
              <li>Ensure that only authorised staff access the Parkkal system.</li>
              <li>Promptly notify Parkkal of any suspected data breach involving clinic credentials.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">4. Obligations of Parkkal (Data Processor)</h2>
            <ul className="list-disc pl-5 text-slate-600 space-y-1">
              <li>Process personal data only on documented instructions from the Data Fiduciary.</li>
              <li>Implement appropriate technical and organisational measures to protect personal data, including AES-256-GCM encryption of sensitive government identifiers.</li>
              <li>Not transfer personal data outside India without adequate safeguards unless required by law.</li>
              <li>Assist the Data Fiduciary in fulfilling data subject rights requests (access, correction, erasure).</li>
              <li>Notify the Data Fiduciary within 72 hours of becoming aware of a personal data breach.</li>
              <li>Delete or return all personal data upon termination of the service, unless retention is required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">5. Data Retention</h2>
            <p className="text-slate-600">
              Patient records are retained for the period configured in your organisation settings (default: 7 years),
              consistent with the retention period recommended for clinical records under Indian law. The Clinic may
              adjust this period within permissible legal limits from the organisation settings page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">6. Right to Erasure</h2>
            <p className="text-slate-600">
              The Clinic may permanently erase all data relating to a patient at any time by using the
              &ldquo;Erase Patient Data&rdquo; function on the patient profile page. This action is irreversible
              and is logged in the audit trail for compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">7. Sub-processors</h2>
            <p className="text-slate-600">
              Parkkal uses the following sub-processors: Cloudflare, Inc. (infrastructure and database), Resend,
              Inc. (transactional email), and Stripe, Inc. (subscription billing). Each sub-processor is bound by
              data processing terms no less protective than this DPA. An up-to-date sub-processor list is
              published at{" "}<a href="/legal/privacy" className="text-blue-600 hover:underline">parkkal.com/legal/privacy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">8. Governing Law</h2>
            <p className="text-slate-600">
              This DPA is governed by the laws of India. Any disputes shall be subject to the exclusive
              jurisdiction of the courts of Tamil Nadu, India.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">9. Contact</h2>
            <p className="text-slate-600">
              For data protection enquiries, contact:{" "}
              <a href="mailto:privacy@parkkal.com" className="text-blue-600 hover:underline">privacy@parkkal.com</a>
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-between items-center">
          <p className="text-xs text-slate-400">Parkkal DPA v1 &mdash; Last updated June 2025</p>
          <Link
            href="/accept-dpa"
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Accept &amp; Continue
          </Link>
        </div>
      </div>
    </div>
  );
}
