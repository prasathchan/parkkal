-- ── Subscription billing ──────────────────────────────────────────────────────
-- Plans (managed by superadmin; prices editable at runtime via the admin panel)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT,
  price_monthly  REAL NOT NULL DEFAULT 0,
  max_doctors    INTEGER,           -- NULL = unlimited
  max_staff      INTEGER,           -- NULL = unlimited
  features       TEXT NOT NULL DEFAULT '[]', -- JSON array of feature keys
  is_active      INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

-- Coupons (discount codes)
CREATE TABLE IF NOT EXISTS coupons (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  description    TEXT,
  discount_type  TEXT NOT NULL CHECK(discount_type IN ('percent','amount')),
  discount_value REAL NOT NULL,   -- percent: 0–100, amount: INR
  max_uses       INTEGER,         -- NULL = unlimited
  used_count     INTEGER NOT NULL DEFAULT 0,
  valid_from     INTEGER,         -- epoch ms; NULL = always valid from creation
  valid_until    INTEGER,         -- epoch ms; NULL = no expiry
  plan_slug      TEXT,            -- NULL = applies to any plan
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

-- Subscriptions (one active row per org)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL REFERENCES organizations(id),
  plan_id                 TEXT NOT NULL REFERENCES subscription_plans(id),
  status                  TEXT NOT NULL DEFAULT 'trialing'
                            CHECK(status IN ('trialing','active','past_due','cancelled','expired')),
  trial_end_at            INTEGER,   -- epoch ms
  current_period_start    INTEGER,   -- epoch ms
  current_period_end      INTEGER,   -- epoch ms
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT,
  coupon_id               TEXT REFERENCES coupons(id),
  discount_applied        REAL NOT NULL DEFAULT 0,  -- actual INR discount applied
  cancelled_at            INTEGER,
  notes                   TEXT,      -- admin notes (e.g. "cash payment received")
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);

-- Coupon redemption log
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id              TEXT PRIMARY KEY,
  coupon_id       TEXT NOT NULL REFERENCES coupons(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  redeemed_at     INTEGER NOT NULL
);

-- Super-admin flag on users
ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0;

-- ── Seed default plans ────────────────────────────────────────────────────────
INSERT INTO subscription_plans (id, name, slug, description, price_monthly, max_doctors, max_staff, features, is_active, sort_order, created_at, updated_at) VALUES
  ('plan_trial',      'Free Trial',  'trial',      '30-day full-access trial',           0,      1,    5,    '["patients","visits","billing","reports","appointments","treatments"]', 1, 0, unixepoch()*1000, unixepoch()*1000),
  ('plan_solo',       'Solo',        'solo',        'Perfect for single-chair clinics',   1499,   1,    5,    '["patients","visits","billing","reports","appointments","treatments"]', 1, 1, unixepoch()*1000, unixepoch()*1000),
  ('plan_clinic',     'Clinic',      'clinic',      'Multi-doctor clinics',               3499,   5,    20,   '["patients","visits","billing","reports","appointments","treatments","salary","roles"]', 1, 2, unixepoch()*1000, unixepoch()*1000),
  ('plan_enterprise', 'Enterprise',  'enterprise',  'Large clinics and chains',           8999,   NULL, NULL, '["patients","visits","billing","reports","appointments","treatments","salary","roles","api"]', 1, 3, unixepoch()*1000, unixepoch()*1000);
