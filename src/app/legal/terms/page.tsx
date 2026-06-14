import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service — Parkkal" };

const EFFECTIVE_DATE = "12 June 2025";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <nav className="text-sm text-pk-text-muted mb-8">
          <Link href="/" className="hover:text-pk-text-secondary">Parkkal</Link>
          <span className="mx-2">/</span>
          <span>Terms of Service</span>
        </nav>

        <h1 className="text-3xl font-bold text-pk-text mb-2">Terms of Service</h1>
        <p className="text-sm text-pk-text-muted mb-10">Effective {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-8">

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">1. Agreement</h2>
            <p className="text-pk-text-secondary">
              By creating a Parkkal account or using the Parkkal platform (&ldquo;Service&rdquo;), the dental clinic
              or individual (&ldquo;you&rdquo; or &ldquo;Clinic&rdquo;) agrees to these Terms of Service
              (&ldquo;Terms&rdquo;). If you are registering on behalf of a clinic, you represent that you have the
              authority to bind the clinic to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">2. The Service</h2>
            <p className="text-pk-text-secondary">
              Parkkal provides a multi-tenant dental clinic management platform including patient records,
              appointment scheduling, treatment planning, billing, and reporting tools. The Service is
              provided on a software-as-a-service basis. We reserve the right to modify or discontinue
              features with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">3. Account Registration</h2>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>You must provide accurate and complete information when registering.</li>
              <li>You are responsible for maintaining the confidentiality of your credentials.</li>
              <li>You must immediately notify us at <a href="mailto:support@parkkal.com" className="text-pk-teal-600 hover:underline">support@parkkal.com</a> of any unauthorised use of your account.</li>
              <li>One organisation account per dental clinic. Creating duplicate accounts to circumvent limits is prohibited.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">4. Subscription and Payment</h2>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>Parkkal offers a free trial period. After the trial, continued use requires a paid subscription.</li>
              <li>Subscription fees are billed monthly or annually in advance, as selected at checkout.</li>
              <li>All fees are exclusive of applicable taxes (including GST). You are responsible for any taxes applicable in your jurisdiction.</li>
              <li>Payments are processed by Stripe. By subscribing, you agree to Stripe&rsquo;s <a href="https://stripe.com/en-in/legal" className="text-pk-teal-600 hover:underline" target="_blank" rel="noreferrer">Terms of Service</a>.</li>
              <li>You may cancel your subscription at any time. Access continues until the end of the paid period. No refunds are issued for partial periods.</li>
              <li>We reserve the right to change subscription pricing with 30 days&rsquo; notice. Existing annual subscribers retain their rate until renewal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">5. Acceptable Use</h2>
            <p className="text-pk-text-secondary mb-2">You agree <strong>not</strong> to:</p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>Use the Service for any purpose that violates applicable law, including the DPDP Act, 2023 and the Information Technology Act, 2000</li>
              <li>Store data unrelated to dental clinic operations</li>
              <li>Attempt to access data belonging to another clinic</li>
              <li>Reverse-engineer, decompile, or scrape the Service</li>
              <li>Use the Service to transmit malware, spam, or abusive content</li>
              <li>Resell or sublicense access to the Service without written permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">6. Patient Data and DPDP Compliance</h2>
            <p className="text-pk-text-secondary">
              You are the Data Fiduciary for patient data under the DPDP Act, 2023. You are responsible for:
            </p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1 mt-1">
              <li>Obtaining valid patient consent before entering patient data into Parkkal</li>
              <li>Informing patients of their rights under the DPDP Act</li>
              <li>Ensuring that your use of Parkkal complies with all applicable clinical data laws</li>
            </ul>
            <p className="text-pk-text-secondary mt-2">
              Our obligations as Data Processor are set out in the{" "}
              <Link href="/legal/dpa/v1" className="text-pk-teal-600 hover:underline">Data Processing Agreement</Link>,
              which forms part of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">7. Intellectual Property</h2>
            <p className="text-pk-text-secondary">
              Parkkal retains all intellectual property rights in the platform, including its software,
              design, and documentation. You retain all rights in the clinic and patient data you enter into
              the platform. You grant Parkkal a limited, non-exclusive licence to process that data solely
              to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">8. Availability and Uptime</h2>
            <p className="text-pk-text-secondary">
              We target 99.5% monthly uptime for the Service, excluding scheduled maintenance windows
              (communicated with at least 24 hours&rsquo; notice) and events beyond our reasonable control
              (force majeure). Current service status is available at{" "}
              <Link href="/status" className="text-pk-teal-600 hover:underline">parkkal.com/status</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">9. Limitation of Liability</h2>
            <p className="text-pk-text-secondary">
              To the fullest extent permitted by Indian law, Parkkal&rsquo;s total liability for any claim
              arising from these Terms or the use of the Service shall not exceed the fees paid by you in
              the 3 months immediately preceding the claim. We are not liable for indirect, incidental,
              consequential, or punitive damages, including loss of data, loss of profits, or clinical
              outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">10. Indemnification</h2>
            <p className="text-pk-text-secondary">
              You agree to indemnify and hold Parkkal harmless from any claim, loss, or expense (including
              reasonable legal fees) arising from your breach of these Terms, your violation of any law,
              or your infringement of any third-party right.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">11. Termination</h2>
            <p className="text-pk-text-secondary">
              Either party may terminate the subscription at any time. We may suspend or terminate your
              account immediately for material breach of these Terms (e.g., misuse of patient data,
              fraudulent activity, or non-payment). Upon termination, your data is retained for 30 days
              during which you may export it; after that it is permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">12. Governing Law and Disputes</h2>
            <p className="text-pk-text-secondary">
              These Terms are governed by the laws of India. Any dispute arising from these Terms shall
              be subject to the exclusive jurisdiction of the courts of Tamil Nadu, India. We encourage
              disputes to be resolved amicably first by contacting{" "}
              <a href="mailto:support@parkkal.com" className="text-pk-teal-600 hover:underline">support@parkkal.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">13. Changes to These Terms</h2>
            <p className="text-pk-text-secondary">
              We may update these Terms from time to time. Material changes will be communicated by email
              at least 14 days before they take effect. Continued use of the Service after that date
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">14. Contact</h2>
            <p className="text-pk-text-secondary">
              Parkkal<br />
              Email: <a href="mailto:support@parkkal.com" className="text-pk-teal-600 hover:underline">support@parkkal.com</a><br />
              For data/privacy matters: <a href="mailto:privacy@parkkal.com" className="text-pk-teal-600 hover:underline">privacy@parkkal.com</a>
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-pk-border text-xs text-pk-text-muted flex gap-6">
          <Link href="/legal/privacy" className="hover:text-pk-text-secondary">Privacy Policy</Link>
          <Link href="/legal/dpa/v1" className="hover:text-pk-text-secondary">Data Processing Agreement</Link>
        </div>
      </div>
    </div>
  );
}
