import Link from "next/link";

export const metadata = {
  title: "Parkkal — One Platform. Every Clinic. Zero Compromises",
  description: "Modern dental clinic management software built for Indian practices. Patients, visits, billing, appointments — all in one place.",
};

const features = [
  {
    icon: "👥",
    title: "Patient Management",
    desc: "Complete patient records with tooth charts, medical history, DPDP-compliant consent, and encrypted PII storage.",
  },
  {
    icon: "📅",
    title: "Appointments & Scheduling",
    desc: "Calendar view, slot-level double-booking prevention, automated SMS & WhatsApp reminders.",
  },
  {
    icon: "🦷",
    title: "Visit & Treatment Plans",
    desc: "Record visit items, prescriptions, attachments, and multi-step treatment plans with digital consent.",
  },
  {
    icon: "💰",
    title: "Billing & Invoicing",
    desc: "GST-ready invoices (CGST/SGST), payment tracking, aging reports, and coupon support.",
  },
  {
    icon: "📊",
    title: "Analytics & Reports",
    desc: "Revenue trends, visit funnel, period-over-period comparison, procedure breakdown — all exportable as CSV.",
  },
  {
    icon: "👨‍⚕️",
    title: "Staff & Roles",
    desc: "Custom RBAC roles, salary records, audit log, and per-staff permission management.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "₹1,499",
    desc: "Perfect for solo practitioners",
    features: ["Up to 2 doctors", "Up to 5 staff", "Unlimited patients", "Appointments & billing", "Email support"],
    highlight: false,
  },
  {
    name: "Growth",
    price: "₹3,499",
    desc: "For growing multi-chair clinics",
    features: ["Up to 5 doctors", "Up to 15 staff", "Everything in Starter", "Advanced reports", "WhatsApp reminders", "Priority support"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "For clinic chains & hospitals",
    features: ["Unlimited doctors & staff", "Multi-location support", "Custom integrations", "SLA guarantee", "Dedicated CSM"],
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-pk-surface text-pk-text">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-pk-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-pk-teal-600 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
              </svg>
            </div>
            <span className="font-bold text-lg text-pk-text">Parkkal</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-pk-text-secondary">
            <a href="#features" className="hover:text-pk-text transition">Features</a>
            <a href="#pricing" className="hover:text-pk-text transition">Pricing</a>
            <a href="mailto:support@parkkal.com" className="hover:text-pk-text transition">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-pk-text-secondary hover:text-pk-text transition">Sign in</Link>
            <Link href="/signup" className="bg-pk-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-pk-teal-700 transition">
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-pk-teal-600 via-pk-teal-700 to-pk-teal-900 text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-pk-teal-500/30 border border-pk-teal-400/30 rounded-full px-4 py-1.5 text-sm font-medium mb-8">
            🇮🇳 Built for Indian dental clinics · DPDP compliant
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            One Platform.<br />Every Clinic.<br />Zero Compromises.
          </h1>
          <p className="text-xl text-pk-teal-100 max-w-2xl mx-auto mb-10">
            Parkkal brings patients, appointments, billing, and reports into a single elegant workspace — so your team can focus on care, not paperwork.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-pk-surface text-pk-teal-700 font-bold text-base px-8 py-3.5 rounded-xl hover:bg-pk-teal-50 transition shadow-lg">
              Start 14-day free trial
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a href="mailto:support@parkkal.com?subject=Demo%20request"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-white/10 transition">
              Request a demo
            </a>
          </div>
          <p className="text-pk-teal-200 text-sm mt-6">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-pk-surface-raised">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-pk-text mb-3">Everything your clinic needs</h2>
            <p className="text-pk-text-muted text-lg max-w-xl mx-auto">Designed from the ground up for dental practices in India — not adapted from a generic template.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-pk-surface rounded-2xl border border-pk-border p-6 hover:shadow-md transition">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-pk-text text-lg mb-2">{f.title}</h3>
                <p className="text-pk-text-muted text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance callout */}
      <section className="py-14 px-6 bg-pk-teal-600 text-white">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="text-5xl flex-shrink-0">🔒</div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Security & compliance, built in</h2>
            <p className="text-pk-teal-100 leading-relaxed">
              AES-256 encryption for all PII fields. DPDP Act consent tracking at registration. Complete audit log for every action. Data retention policies enforced automatically. Your patients&apos; data is safe — full stop.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-pk-surface">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-pk-text mb-3">Simple, honest pricing</h2>
            <p className="text-pk-text-muted text-lg">All plans include a 14-day free trial. No hidden fees.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {plans.map((p) => (
              <div key={p.name} className={`rounded-2xl border p-8 flex flex-col ${p.highlight ? "border-pk-teal-500 ring-2 ring-pk-teal-500 bg-pk-teal-50" : "border-pk-border"}`}>
                {p.highlight && (
                  <div className="text-xs font-bold text-pk-teal-600 uppercase tracking-wider mb-3">Most popular</div>
                )}
                <h3 className="text-xl font-bold text-pk-text mb-1">{p.name}</h3>
                <p className="text-pk-text-muted text-sm mb-4">{p.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-pk-text">{p.price}</span>
                  {p.price !== "Custom" && <span className="text-pk-text-muted text-sm ml-1">/month + GST</span>}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-pk-text-secondary">
                      <svg className="h-4 w-4 text-pk-success-text flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                {p.price === "Custom" ? (
                  <a href="mailto:support@parkkal.com?subject=Enterprise%20enquiry"
                    className="block text-center border border-pk-border-strong text-pk-text-secondary font-semibold py-3 rounded-xl hover:bg-pk-surface-raised transition text-sm">
                    Contact us
                  </a>
                ) : (
                  <Link href="/signup"
                    className={`block text-center font-semibold py-3 rounded-xl text-sm transition ${p.highlight ? "bg-pk-teal-600 text-white hover:bg-pk-teal-700" : "bg-pk-neutral-900 text-white hover:bg-pk-neutral-800"}`}>
                    Start free trial
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-pk-neutral-900 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to modernise your clinic?</h2>
          <p className="text-pk-text-muted text-lg mb-8">Join dental clinics across India who trust Parkkal to run their practice.</p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 bg-pk-teal-600 text-white font-bold text-base px-8 py-3.5 rounded-xl hover:bg-pk-teal-700 transition">
            Start your free trial today
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-pk-neutral-900 text-pk-text-muted py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-pk-teal-600 rounded flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
              </svg>
            </div>
            <span className="font-semibold text-pk-text-muted">Parkkal</span>
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/login" className="hover:text-pk-text-muted transition">Sign in</Link>
            <Link href="/signup" className="hover:text-pk-text-muted transition">Sign up</Link>
            <a href="mailto:support@parkkal.com" className="hover:text-pk-text-muted transition">Support</a>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} Parkkal. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
