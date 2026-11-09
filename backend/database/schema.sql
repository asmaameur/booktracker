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
  cover_image_url  TEXT,
  pdf_url          TEXT,
  publication_year SMALLINT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT books_publication_year_check CHECK (publication_year BETWEEN 1 AND 2100)
);

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

-- ===========================================================================
-- Genres, ratings, notifications and recommendations
-- Everything below is also safe to re-run on an existing database: it adds
-- what is missing and gives every existing book a genre.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- genres: the fixed list of genres a book can belong to
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS genres (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT genres_name_unique UNIQUE (name)
);

INSERT INTO genres (name) VALUES
  ('Fiction'), ('Fantasy'), ('Science Fiction'), ('Romance'), ('Mystery'), ('Thriller'),
  ('Horror'), ('History'), ('Biography'), ('Self-development'), ('Technology'), ('Educational')
ON CONFLICT (name) DO NOTHING;

-- Every book has exactly one genre. Genres replace the old free-text
-- "category" column.
ALTER TABLE books ADD COLUMN IF NOT EXISTS genre_id INTEGER REFERENCES genres (id) ON DELETE RESTRICT;

-- Databases from before genres: give each book the genre that matches its old
-- category (exact name first, then common keywords, else Fiction), then
-- remove the category column. Skipped once the column is gone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'books' AND column_name = 'category'
  ) THEN
    EXECUTE $sql$
      UPDATE books b
      SET genre_id = COALESCE(
        (SELECT g.id FROM genres g WHERE LOWER(g.name) = LOWER(TRIM(b.category))),
        (SELECT g.id FROM genres g WHERE g.name = CASE
           WHEN b.category ~* '(gothic|horror|ghost|vampire)'                THEN 'Horror'
           WHEN b.category ~* '(sci-?fi|science fiction|dystopi|space)'       THEN 'Science Fiction'
           WHEN b.category ~* '(fantasy|myth|fairy)'                          THEN 'Fantasy'
           WHEN b.category ~* '(romance|love)'                                THEN 'Romance'
           WHEN b.category ~* '(mystery|detective|crime)'                     THEN 'Mystery'
           WHEN b.category ~* '(thriller|suspense|spy)'                       THEN 'Thriller'
           WHEN b.category ~* '(histor|war)'                                  THEN 'History'
           WHEN b.category ~* '(biograph|memoir|autobiograph)'                THEN 'Biography'
           WHEN b.category ~* '(self|personal|psycholog|philosoph)'           THEN 'Self-development'
           WHEN b.category ~* '(tech|computer|programming|software|science)'  THEN 'Technology'
           WHEN b.category ~* '(education|textbook|academic|reference)'       THEN 'Educational'
           ELSE 'Fiction'
         END)
      )
      WHERE b.genre_id IS NULL
    $sql$;
    DROP INDEX IF EXISTS books_category_idx;
    ALTER TABLE books DROP COLUMN category;
  END IF;
END $$;

-- Books added without a genre (none should exist) fall back to Fiction.
UPDATE books SET genre_id = (SELECT id FROM genres WHERE name = 'Fiction') WHERE genre_id IS NULL;

ALTER TABLE books ALTER COLUMN genre_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS books_genre_id_idx ON books (genre_id);

-- ---------------------------------------------------------------------------
-- reviews: one rating (and optional comment) per reader per book
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  book_id    INTEGER     NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  rating     SMALLINT    NOT NULL,
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reviews_user_book_unique UNIQUE (user_id, book_id),
  CONSTRAINT reviews_rating_check     CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT reviews_comment_length   CHECK (comment IS NULL OR char_length(comment) <= 2000)
);

CREATE INDEX IF NOT EXISTS reviews_book_id_idx ON reviews (book_id);

DROP TRIGGER IF EXISTS reviews_set_updated_at ON reviews;
CREATE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications: stored per user so they are waiting after being offline.
--   new_book   -> every reader, when an admin adds a book
--   new_review -> every admin, when a reader rates a book
--   review_removed -> the review's author, when an admin deletes their review
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  book_id    INTEGER     REFERENCES books (id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL DEFAULT 'new_book',
  message    TEXT        NOT NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_check CHECK (type IN ('new_book', 'new_review', 'review_removed'))
);

-- Older databases have a shorter list of types: replace the check so every
-- type above is allowed.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('new_book', 'new_review', 'review_removed'));

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx  ON notifications (user_id) WHERE NOT is_read;

-- ---------------------------------------------------------------------------
-- user_genre_preferences: the genres each reader likes, used for recommendations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_genre_preferences (
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  genre_id   INTEGER     NOT NULL REFERENCES genres (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, genre_id)
);

-- ---------------------------------------------------------------------------
-- password_reset_tokens: "forgot password" links sent by email
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token      CHAR(64)    NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT password_reset_tokens_token_unique UNIQUE (token)
);

COMMENT ON COLUMN password_reset_tokens.token IS 'SHA-256 hash of the token sent by email; the raw token is never stored';

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);

-- ===========================================================================
-- Reading stats and goals, helpful votes on reviews
-- ===========================================================================

-- When a book was finished, kept up to date by a trigger: set when the status
-- becomes "read", cleared when it changes to anything else.
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- Books already marked as read: their last update is the best guess. The
-- updated_at trigger is paused so "last opened" dates do not change.
ALTER TABLE user_books DISABLE TRIGGER user_books_set_updated_at;
UPDATE user_books SET finished_at = updated_at WHERE reading_status = 'read' AND finished_at IS NULL;
ALTER TABLE user_books ENABLE TRIGGER user_books_set_updated_at;

CREATE OR REPLACE FUNCTION set_finished_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reading_status = 'read' THEN
    IF TG_OP = 'INSERT' OR OLD.reading_status IS DISTINCT FROM 'read' THEN
      NEW.finished_at = NOW();
    END IF;
  ELSE
    NEW.finished_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_books_set_finished_at ON user_books;
CREATE TRIGGER user_books_set_finished_at
  BEFORE INSERT OR UPDATE ON user_books FOR EACH ROW EXECUTE FUNCTION set_finished_at();

CREATE INDEX IF NOT EXISTS user_books_user_finished_idx ON user_books (user_id, finished_at);

-- ---------------------------------------------------------------------------
-- reading_activity: pages read per reader per day (from saved progress)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reading_activity (
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day     DATE    NOT NULL,
  pages   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day),
  CONSTRAINT reading_activity_pages_check CHECK (pages >= 0)
);

-- ---------------------------------------------------------------------------
-- reading_goals: how many books a reader wants to finish in a year
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reading_goals (
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  year       SMALLINT    NOT NULL,
  target     SMALLINT    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, year),
  CONSTRAINT reading_goals_target_check CHECK (target BETWEEN 1 AND 1000)
);

DROP TRIGGER IF EXISTS reading_goals_set_updated_at ON reading_goals;
CREATE TRIGGER reading_goals_set_updated_at
  BEFORE UPDATE ON reading_goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- review_votes: "this review was helpful", one vote per reader per review
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_votes (
  review_id  INTEGER     NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS review_votes_user_id_idx ON review_votes (user_id);
