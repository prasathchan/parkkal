import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy — Parkkal" };

const EFFECTIVE_DATE = "12 June 2025";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-pk-surface">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <nav className="text-sm text-pk-text-muted mb-8">
          <Link href="/" className="hover:text-pk-text-secondary">Parkkal</Link>
          <span className="mx-2">/</span>
          <span>Privacy Policy</span>
        </nav>

        <h1 className="text-3xl font-bold text-pk-text mb-2">Privacy Policy</h1>
        <p className="text-sm text-pk-text-muted mb-10">Effective {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-8">

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">1. Who We Are</h2>
            <p className="text-pk-text-secondary">
              Parkkal (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the Parkkal dental clinic
              management platform accessible at <strong>app.parkkal.com</strong>. We are a Data Processor under
              India&rsquo;s Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;). The dental clinic
              that subscribes to Parkkal is the Data Fiduciary responsible for collecting patient consent.
            </p>
            <p className="text-pk-text-secondary mt-2">
              For privacy enquiries: <a href="mailto:privacy@parkkal.com" className="text-pk-teal-600 hover:underline">privacy@parkkal.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">2. Information We Collect</h2>
            <p className="text-pk-text-secondary mb-2"><strong>About clinic staff (Account Data):</strong></p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>Name, email address, and phone number</li>
              <li>Role within the clinic and login credentials (passwords stored as bcrypt hashes — never in plain text)</li>
              <li>Audit log entries recording which staff member performed which action</li>
            </ul>
            <p className="text-pk-text-secondary mt-3 mb-2"><strong>About patients (Clinical Data — processed on behalf of the clinic):</strong></p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>Name, date of birth, gender, contact details</li>
              <li>Clinical records: visit notes, diagnoses, treatment plans, prescriptions, X-rays and attachments</li>
              <li>Financial records: invoices and payment history</li>
              <li>Government identifiers (Aadhaar, PAN) — stored encrypted with AES-256-GCM; never logged or transmitted in plain text</li>
            </ul>
            <p className="text-pk-text-secondary mt-3 mb-2"><strong>Automatically collected:</strong></p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>IP addresses and request timestamps for security and rate-limiting</li>
              <li>Server-side error logs (patient names and identifiers are never included in logs — only record IDs)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>To provide and operate the clinic management platform</li>
              <li>To send transactional emails: account activation, OTP verification, appointment reminders, and billing receipts</li>
              <li>To detect and prevent security incidents and abuse</li>
              <li>To comply with applicable Indian law, including the DPDP Act, 2023</li>
            </ul>
            <p className="text-pk-text-secondary mt-2">We do not sell personal data. We do not use patient data for advertising.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">4. Legal Basis for Processing</h2>
            <p className="text-pk-text-secondary">
              We process personal data on the basis of:
            </p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1 mt-1">
              <li><strong>Contractual necessity</strong> — to deliver the services you have subscribed to</li>
              <li><strong>Legitimate interest</strong> — for security monitoring, fraud prevention, and service improvement</li>
              <li><strong>Legal obligation</strong> — to comply with Indian tax, clinical record-keeping, and data protection laws</li>
              <li><strong>Consent</strong> — for optional marketing communications (you may withdraw at any time)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">5. Data Storage and Security</h2>
            <p className="text-pk-text-secondary">
              All data is stored in Cloudflare D1 databases (SQLite at the edge). Sensitive identifiers
              (Aadhaar, PAN) are encrypted at rest using AES-256-GCM before being written to the database.
              Data is replicated within Cloudflare&rsquo;s infrastructure and covered by Cloudflare&rsquo;s security certifications.
            </p>
            <p className="text-pk-text-secondary mt-2">
              We employ rate limiting, JWT-based authentication, HTTPS-only transport, and role-based
              access control to protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">6. Data Retention</h2>
            <p className="text-pk-text-secondary">
              Patient clinical records are retained for the period configured in your organisation settings
              (default: 7 years), consistent with clinical record-keeping obligations under Indian law.
              Account data is retained for the duration of the subscription and for 30 days after cancellation,
              after which it is permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">7. Sub-processors</h2>
            <p className="text-pk-text-secondary mb-2">
              We share data with the following service providers solely to operate the platform:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-pk-border rounded-pk-sm overflow-hidden">
                <thead className="bg-pk-surface-raised">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-pk-text-secondary">Sub-processor</th>
                    <th className="text-left px-4 py-2 font-medium text-pk-text-secondary">Purpose</th>
                    <th className="text-left px-4 py-2 font-medium text-pk-text-secondary">Data Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pk-border">
                  <tr>
                    <td className="px-4 py-2 text-pk-text-secondary">Cloudflare, Inc.</td>
                    <td className="px-4 py-2 text-pk-text-secondary">Infrastructure, database, CDN, DDoS protection</td>
                    <td className="px-4 py-2 text-pk-text-secondary">Global edge (replicated)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-pk-text-secondary">Resend, Inc.</td>
                    <td className="px-4 py-2 text-pk-text-secondary">Transactional email delivery</td>
                    <td className="px-4 py-2 text-pk-text-secondary">United States</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-pk-text-secondary">Stripe, Inc.</td>
                    <td className="px-4 py-2 text-pk-text-secondary">Subscription billing and payment processing</td>
                    <td className="px-4 py-2 text-pk-text-secondary">United States</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">8. Your Rights (DPDP Act, 2023)</h2>
            <p className="text-pk-text-secondary mb-2">
              Under the Digital Personal Data Protection Act, 2023, you have the right to:
            </p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li><strong>Access</strong> — request a summary of personal data we hold about you</li>
              <li><strong>Correction</strong> — request correction of inaccurate data</li>
              <li><strong>Erasure</strong> — request deletion of your personal data (subject to legal retention obligations)</li>
              <li><strong>Grievance redressal</strong> — lodge a complaint with our Data Protection Officer</li>
              <li><strong>Nominate</strong> — nominate a person to exercise rights on your behalf in the event of death or incapacity</li>
            </ul>
            <p className="text-pk-text-secondary mt-2">
              To exercise any of these rights, email <a href="mailto:privacy@parkkal.com" className="text-pk-teal-600 hover:underline">privacy@parkkal.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">9. Cross-Border Data Transfers</h2>
            <p className="text-pk-text-secondary">
              Some of our sub-processors (Resend, Stripe) are based outside India. Data transferred to these
              processors is covered by their respective data processing agreements and is limited to the minimum
              necessary for the stated purpose (e.g., the recipient email address for transactional email delivery).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">10. Cookies</h2>
            <p className="text-pk-text-secondary">
              Parkkal uses a single session cookie (<code>pkd_org_session</code>) to maintain your login state.
              This cookie is HTTP-only, Secure, and SameSite=Strict. We do not use tracking cookies,
              analytics cookies, or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">11. Data Breach Notification</h2>
            <p className="text-pk-text-secondary">
              In the event of a personal data breach, we will notify affected clinics within 72 hours of
              becoming aware of the breach, consistent with our obligations under the DPDP Act, 2023.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">12. Changes to This Policy</h2>
            <p className="text-pk-text-secondary">
              We may update this Privacy Policy from time to time. Material changes will be communicated
              by email to the registered admin of each clinic account at least 14 days before they take effect.
              Continued use of the platform after that date constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">13. Contact</h2>
            <p className="text-pk-text-secondary">
              Data Protection Officer / Grievance Officer<br />
              Parkkal<br />
              Email: <a href="mailto:privacy@parkkal.com" className="text-pk-teal-600 hover:underline">privacy@parkkal.com</a>
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-pk-border text-xs text-pk-text-muted flex gap-6">
          <Link href="/legal/terms" className="hover:text-pk-text-secondary">Terms of Service</Link>
          <Link href="/legal/dpa/v1" className="hover:text-pk-text-secondary">Data Processing Agreement</Link>
        </div>
      </div>
    </div>
  );
}
