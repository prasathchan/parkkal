# Items Requiring Legal / Business Review

These CANNOT be completed by engineering. Each blocks a specific launch tier
(see readiness report). Owner: Prasath. Status: ❌ open unless noted.

1. **Privacy policy & terms of service** — drafts in
   `/Users/prasathchan/Documents/parkkal/legal/privacy/` need counsel review,
   then publish at `/legal/privacy` and `/legal/terms` and link from signup.
   *Blocks: public self-serve.*

2. **Vendor DPAs** — execute data-processing agreements with Cloudflare,
   Resend, Twilio, Stripe (all offer standard online DPAs). File copies in
   `/Users/prasathchan/Documents/parkkal/legal/`. *Blocks: enterprise; should
   precede paid pilot.*

3. **Clinic-facing DPA template** — template exists in `legal/hipaa/`; needs
   India-specific counsel pass (DPDP processor terms, not HIPAA). *Blocks:
   enterprise.*

4. **DPDP breach-notification procedure** — confirm with counsel the exact
   notification timeline/format to the Data Protection Board and Data
   Principals under the DPDP Rules, and whether Parkkal or the clinic (as
   fiduciary) carries the duty in our processor model. Wire conclusions into
   docs/ops/INCIDENT_RESPONSE.md. *Blocks: paid pilot (should), enterprise (must).*

5. **Significant Data Fiduciary assessment** — health data processing may
   trigger SDF obligations (DPO appointment, audits, DPIA). Needs counsel
   opinion once user volumes are known. *Blocks: enterprise.*

6. **GST registration & invoice compliance** — confirm Parkkal's own GSTIN,
   SAC code for SaaS (998314 vs current default), and invoice format with a
   CA before charging money. *Blocks: paid pilot.*

7. **Stripe India activation** — Stripe India requires business verification;
   confirm INR subscriptions + export rules, or choose Razorpay instead
   (engineering will adapt — checkout is isolated in
   `src/app/api/stripe/create-checkout/route.ts`). *Blocks: public self-serve.*

8. **Pricing console access policy sign-off** — approve
   pricing-console `docs/ACCESS_POLICY.md` and decide on Cloudflare Access
   enrolment. *Blocks: hiring first non-founder console user.*
