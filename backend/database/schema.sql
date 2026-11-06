-- BookTracker database schema (PostgreSQL 13 or newer).
-- Safe to run several times: each statement only creates what is missing.
-- Run it with `npm run db:init`, or paste it into pgAdmin's Query Tool.

-- Keeps every updated_at column current without relying on application code.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users: readers and administrators
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  email               VARCHAR(255) NOT NULL,
  password            VARCHAR(255) NOT NULL,
  role                VARCHAR(10)  NOT NULL DEFAULT 'user',
  is_verified         BOOLEAN      NOT NULL DEFAULT FALSE,
  password_changed_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique    UNIQUE (email),
  CONSTRAINT users_email_lowercase CHECK (email = LOWER(email)),
  CONSTRAINT users_role_check      CHECK (role IN ('admin', 'user'))
);

COMMENT ON COLUMN users.password IS 'bcrypt hash; the plain-text password is never stored';
COMMENT ON COLUMN users.password_changed_at IS 'Login tokens issued before this moment are rejected';

-- ---------------------------------------------------------------------------
-- books: the shared catalogue managed by administrators
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title            VARCHAR(255) NOT NULL,
  author           VARCHAR(255) NOT NULL,
  description      TEXT,
  category         VARCHAR(100),
  cover_image_url  TEXT,
  pdf_url          TEXT,
  publication_year SMALLINT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT books_publication_year_check CHECK (publication_year BETWEEN 1 AND 2100)
);

CREATE INDEX IF NOT EXISTS books_category_idx   ON books (LOWER(category));
CREATE INDEX IF NOT EXISTS books_created_at_idx ON books (created_at DESC);

-- ---------------------------------------------------------------------------
-- user_books: each reader's personal library and reading progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_books (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  book_id        INTEGER     NOT NULL REFERENCES books (id) ON DELETE RESTRICT,
  reading_status VARCHAR(10) NOT NULL DEFAULT 'to_read',
  current_page   INTEGER     NOT NULL DEFAULT 0,
  total_pages    INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_books_user_book_unique  UNIQUE (user_id, book_id),
  CONSTRAINT user_books_status_check      CHECK (reading_status IN ('to_read', 'reading', 'read')),
  CONSTRAINT user_books_current_page_check CHECK (current_page >= 0),
  CONSTRAINT user_books_total_pages_check CHECK (total_pages IS NULL OR total_pages >= 1),
  CONSTRAINT user_books_page_within_total CHECK (total_pages IS NULL OR current_page <= total_pages)
);

COMMENT ON COLUMN user_books.current_page IS 'Last page the reader saved; 0 means not started yet';

-- The unique (user_id, book_id) constraint already indexes lookups by user.
CREATE INDEX IF NOT EXISTS user_books_book_id_idx ON user_books (book_id);

-- ---------------------------------------------------------------------------
-- email_verification_tokens: links sent by email to confirm an address
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token      CHAR(64)     NOT NULL,
  email      VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT email_verification_tokens_token_unique UNIQUE (token)
);

COMMENT ON COLUMN email_verification_tokens.token IS 'SHA-256 hash of the token sent by email; the raw token is never stored';
COMMENT ON COLUMN email_verification_tokens.email IS 'Address this token confirms: the account email at sign-up, or the new address during an email change';

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx ON email_verification_tokens (user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS books_set_updated_at ON books;
CREATE TRIGGER books_set_updated_at
  BEFORE UPDATE ON books FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS user_books_set_updated_at ON user_books;
CREATE TRIGGER user_books_set_updated_at
  BEFORE UPDATE ON user_books FOR EACH ROW EXECUTE FUNCTION set_updated_at();
