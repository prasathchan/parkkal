import Link from "next/link";

export const metadata = { title: "Business Associate Agreement v1 — Parkkal" };

export default function BaaV1Page() {
  return (
    <div className="min-h-screen bg-pk-surface">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <nav className="text-sm text-pk-text-muted mb-8">
          <Link href="/dashboard" className="hover:text-pk-text-secondary">Dashboard</Link>
          <span className="mx-2">/</span>
          <span>Business Associate Agreement</span>
        </nav>

        <h1 className="text-3xl font-bold text-pk-text mb-2">Business Associate Agreement</h1>
        <p className="text-sm text-pk-text-muted mb-8">Version 1 &mdash; Effective 1 June 2025</p>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">1. Parties</h2>
            <p className="text-pk-text-secondary">
              This Business Associate Agreement (&ldquo;BAA&rdquo;) is entered into between the dental clinic
              or healthcare provider operating a Parkkal account (&ldquo;Covered Entity&rdquo;) and Parkkal
              (&ldquo;Business Associate&rdquo;), collectively &ldquo;the Parties.&rdquo; This BAA is required
              under the Health Insurance Portability and Accountability Act of 1996 (&ldquo;HIPAA&rdquo;) and
              the Health Information Technology for Economic and Clinical Health Act (&ldquo;HITECH&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">2. Definitions</h2>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li><strong>Protected Health Information (PHI)</strong> — any individually identifiable health information transmitted or maintained by Parkkal on behalf of the Covered Entity, as defined in 45 CFR §160.103.</li>
              <li><strong>Electronic PHI (ePHI)</strong> — PHI that is created, received, maintained, or transmitted in electronic form.</li>
              <li><strong>Breach</strong> — the acquisition, access, use, or disclosure of PHI in a manner not permitted under HIPAA that compromises its security or privacy.</li>
              <li><strong>Minimum Necessary</strong> — limiting the use and disclosure of PHI to the minimum amount necessary to accomplish the intended purpose.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">3. Obligations of Parkkal (Business Associate)</h2>
            <p className="text-pk-text-secondary mb-2">Parkkal agrees to:</p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>Not use or disclose PHI other than as permitted or required by this BAA or as required by law.</li>
              <li>Use appropriate safeguards, and implement the HIPAA Security Rule requirements at 45 CFR Part 164, Subpart C, to prevent use or disclosure of PHI other than as provided in this BAA.</li>
              <li>Report to the Covered Entity any use or disclosure of PHI not provided for in this BAA, including breaches of unsecured PHI, within 30 days of discovery.</li>
              <li>Ensure that any subcontractors that create, receive, maintain, or transmit PHI on behalf of Parkkal agree to the same restrictions and conditions.</li>
              <li>Make its internal practices, books, and records available to the Secretary of HHS for determining compliance with HIPAA.</li>
              <li>Return or destroy all PHI upon termination of services, to the extent feasible.</li>
              <li>Implement and maintain administrative, physical, and technical safeguards including: AES-256-GCM encryption for PII fields at rest, TLS 1.2+ for data in transit, role-based access controls, and comprehensive audit logging.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">4. Permitted Uses and Disclosures</h2>
            <p className="text-pk-text-secondary mb-2">Parkkal may use or disclose PHI only to:</p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>Provide the dental clinic management services specified in the Parkkal Terms of Service.</li>
              <li>Perform data aggregation services relating to the health care operations of the Covered Entity.</li>
              <li>Report violations of law to appropriate authorities as required.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">5. Obligations of the Covered Entity</h2>
            <p className="text-pk-text-secondary mb-2">The Covered Entity agrees to:</p>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>Notify Parkkal of any restriction on the use or disclosure of PHI that the Covered Entity has agreed to or is required to abide by.</li>
              <li>Notify Parkkal of any changes in, or revocation of, authorization by an individual to use or disclose PHI, to the extent such changes affect Parkkal&rsquo;s permitted or required uses and disclosures.</li>
              <li>Not request that Parkkal use or disclose PHI in any manner that would not be permissible under HIPAA if done by the Covered Entity directly.</li>
              <li>Obtain any consent or authorisation required under applicable law prior to furnishing PHI to Parkkal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">6. Individual Rights</h2>
            <p className="text-pk-text-secondary">
              Parkkal will support the Covered Entity in fulfilling patient rights under HIPAA, including the
              right to access, amend, and request an accounting of disclosures of their PHI. The Covered Entity
              remains responsible for responding to individuals exercising these rights. Patient data can be
              permanently erased on request via the right-to-erasure feature available on each patient record.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">7. Breach Notification</h2>
            <p className="text-pk-text-secondary">
              In the event of a breach of unsecured PHI, Parkkal will notify the Covered Entity without
              unreasonable delay and in no case later than 30 calendar days after discovery. Notification
              will include: the nature of the breach, PHI involved, steps individuals should take to protect
              themselves, what Parkkal is doing to investigate and mitigate the breach, and contact
              information for further inquiry. The Covered Entity is responsible for notifying affected
              individuals and the Secretary of HHS as required under 45 CFR §164.404 and §164.408.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">8. Term and Termination</h2>
            <p className="text-pk-text-secondary">
              This BAA is effective from the date the Covered Entity accepts it in the Parkkal Settings panel
              and remains in force for the duration of the Parkkal subscription. Either party may terminate
              this BAA immediately upon written notice if the other party materially breaches a provision of
              this BAA and fails to cure such breach within 30 days of notice. Upon termination, Parkkal
              will, at the Covered Entity&rsquo;s election, return or destroy all PHI to the extent
              feasible.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">9. Miscellaneous</h2>
            <ul className="list-disc pl-5 text-pk-text-secondary space-y-1">
              <li>This BAA is incorporated into and forms part of the Parkkal Terms of Service.</li>
              <li>In the event of any inconsistency between this BAA and the Terms of Service with respect to PHI, this BAA controls.</li>
              <li>This BAA will be construed in accordance with applicable federal law. Parkkal will amend this BAA as necessary to comply with changes in HIPAA, HITECH, or related regulations.</li>
              <li>The Covered Entity&rsquo;s electronic acceptance in the Settings panel constitutes a legally binding signature to this BAA.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-pk-text mb-2">10. Contact</h2>
            <p className="text-pk-text-secondary">
              For HIPAA compliance inquiries or to report a security concern, contact Parkkal at{" "}
              <a href="mailto:privacy@parkkal.com" className="text-pk-teal-600 hover:underline">privacy@parkkal.com</a>.
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-pk-border">
          <Link href="/dashboard/settings?tab=security" className="text-sm text-pk-teal-600 hover:underline">
            &larr; Back to Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
