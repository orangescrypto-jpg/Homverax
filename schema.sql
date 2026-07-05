-- ─────────────────────────────────────────────────────────────────────────────
-- HomveraX — Cloudflare D1 Schema
-- Paste into: Cloudflare Dashboard → D1 → Your Database → Console
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL DEFAULT '',
  first_name          TEXT NOT NULL DEFAULT '',
  last_name           TEXT NOT NULL DEFAULT '',
  phone               TEXT,
  avatar_url          TEXT,
  role                TEXT NOT NULL DEFAULT 'tenant',
  role_selected       INTEGER NOT NULL DEFAULT 0,
  is_verified         INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'none',
  subscription_plan   TEXT NOT NULL DEFAULT 'free',
  subscription_expiry TEXT,
  bank_name           TEXT,
  account_number      TEXT,
  account_name        TEXT,
  bank_code           TEXT,
  notif_prefs         TEXT,
  privacy_prefs       TEXT,
  avg_rating          REAL DEFAULT 0,
  review_count        INTEGER DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listings (
  id                    TEXT PRIMARY KEY,
  agent_id              TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  category              TEXT,
  property_type         TEXT,
  listing_type          TEXT,
  price                 REAL,
  price_unit            TEXT,
  state                 TEXT,
  lga                   TEXT,
  address               TEXT,
  latitude              REAL,
  longitude             REAL,
  bedrooms              INTEGER,
  bathrooms             INTEGER,
  toilets               INTEGER,
  parking_spaces        INTEGER,
  area_sq_m             REAL,
  furnished             INTEGER DEFAULT 0,
  images                TEXT DEFAULT '[]',
  video_url             TEXT,
  virtual_tour_url      TEXT,
  boost_type            TEXT DEFAULT 'none',
  boost_expires_at      TEXT,
  is_property_verified  INTEGER DEFAULT 0,
  is_featured           INTEGER DEFAULT 0,
  is_flash_deal         INTEGER DEFAULT 0,
  flash_deal_price      REAL,
  flash_deal_expires_at TEXT,
  agent_rank_boost      INTEGER DEFAULT 0,
  status                TEXT DEFAULT 'draft',
  views                 INTEGER DEFAULT 0,
  saves                 INTEGER DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id            TEXT PRIMARY KEY,
  listing_id    TEXT NOT NULL,
  listing_title TEXT,
  listing_image TEXT,
  listing_price REAL,
  buyer_id      TEXT NOT NULL,
  seller_id     TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  message       TEXT,
  escrow_id     TEXT,
  scheduled_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id       TEXT NOT NULL,
  receiver_id     TEXT NOT NULL,
  listing_id      TEXT,
  content         TEXT NOT NULL,
  read            INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT,
  read       INTEGER DEFAULT 0,
  link       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  listing_id  TEXT,
  rating      INTEGER NOT NULL,
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escrows (
  id         TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  buyer_id   TEXT NOT NULL,
  seller_id  TEXT NOT NULL,
  amount     REAL NOT NULL,
  status     TEXT DEFAULT 'pending',
  -- status now also includes 'payment_rejected' (admin rejected the
  -- buyer's uploaded proof of payment; distinct from 'pending' so the
  -- buyer sees a clear "rejected — retry" banner instead of the plain
  -- unpaid screen). No column change needed — status is just TEXT.
  --
  -- meta (JSON) gained 4 new keys, written by adminRejectTransfer() in
  -- services/escrow.ts — no ALTER TABLE needed, existing rows are
  -- unaffected and simply omit these keys until first rejected:
  --   rejectionReason  TEXT  — one of: amount_mismatch | screenshot_invalid |
  --                            reference_not_found | duplicate_submission | other
  --   rejectionNote    TEXT  — free-text note admin typed, shown to buyer in email
  --   rejectedBy       TEXT  — user id of the admin who rejected
  --   rejectedAt       TEXT  — ISO timestamp of rejection
  meta       TEXT,
  release_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_listings (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  filters    TEXT NOT NULL,
  name       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page_content (
  slug       TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  content      TEXT,
  excerpt      TEXT,
  cover_image  TEXT,
  category     TEXT,
  tags         TEXT DEFAULT '[]',
  status       TEXT DEFAULT 'draft',
  author_id    TEXT,
  author_name  TEXT,
  author_avatar TEXT,
  author_role  TEXT,
  reading_time_minutes INTEGER DEFAULT 3,
  views_count  INTEGER DEFAULT 0,
  featured     INTEGER DEFAULT 0,
  published    INTEGER DEFAULT 0,
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referrals (
  id          TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referred_id TEXT NOT NULL,
  status      TEXT DEFAULT 'pending',
  reward_paid INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id    TEXT PRIMARY KEY,
  balance    REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,
  amount      REAL NOT NULL,
  description TEXT,
  reference   TEXT,
  -- proof_url: set on "Payout completed" rows when admin attached a
  -- transfer screenshot/receipt (manual payout mode). Lets the seller
  -- view the same proof admin has, from their own wallet page and email.
  proof_url   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes for common query patterns ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_agent     ON listings (agent_id);
CREATE INDEX IF NOT EXISTS idx_listings_status    ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_state     ON listings (state);
CREATE INDEX IF NOT EXISTS idx_messages_conv      ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver  ON messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_escrows_buyer      ON escrows (buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrows_seller     ON escrows (seller_id);
CREATE INDEX IF NOT EXISTS idx_escrows_status     ON escrows (status);
CREATE INDEX IF NOT EXISTS idx_reviews_agent      ON reviews (agent_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_user ON saved_listings (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user     ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_buyer     ON bookings (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_seller    ON bookings (seller_id);
CREATE INDEX IF NOT EXISTS idx_blog_slug          ON blog_posts (slug);

-- ─── Added: payouts table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payouts (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  user_name      TEXT NOT NULL,
  amount         REAL NOT NULL,
  bank_name      TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name   TEXT NOT NULL,
  bank_code          TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  note           TEXT,
  reference      TEXT,
  proof_url          TEXT,   -- manual mode: screenshot/receipt admin attaches when marking paid
  payout_method      TEXT,   -- 'manual' | 'paystack' — which path actually paid this out
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at   TEXT
);

-- ─── Migration: existing databases created before bank_code/proof_url/
-- payout_method existed. Run these three ALTER statements manually against
-- your existing D1 database (e.g. via `wrangler d1 execute`) — schema.sql
-- isn't auto-applied on deploy in this project. If a column already exists,
-- D1 will error on that one line; just skip it and run the rest.
ALTER TABLE payouts ADD COLUMN bank_code TEXT;
ALTER TABLE payouts ADD COLUMN proof_url TEXT;
ALTER TABLE payouts ADD COLUMN payout_method TEXT;

CREATE INDEX IF NOT EXISTS idx_payouts_user   ON payouts (user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts (status);

-- ─── Added: verifications table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verifications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE,
  user_name       TEXT NOT NULL,
  user_email      TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'agent',
  status          TEXT NOT NULL DEFAULT 'pending',
  bvn             TEXT,
  nin             TEXT,
  id_document_url TEXT,
  selfie_url      TEXT,
  amount_paid     REAL NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications (status);
CREATE INDEX IF NOT EXISTS idx_verifications_user   ON verifications (user_id);
