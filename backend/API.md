# BookTracker API reference

Base URL in development: `http://localhost:4000/api`

## Conventions

**Format.** Requests and responses use JSON (`Content-Type: application/json`), and field names are in camelCase. Dates are ISO 8601 strings in UTC.

**Authentication.** Log in with `POST /auth/login` to receive a `token`, then send it on every protected request:

```http
Authorization: Bearer <token>
```

Tokens last 1 day by default (`expiresAt` in the login response). Logging out is done by the frontend: it deletes the stored token. Changing the password invalidates all older tokens.

**Roles.** A route marked *Reader* is for accounts with `role: "user"`; *Admin* is for `role: "admin"`; *Any* accepts both. Every protected route also requires a verified email address.

**Errors.** Every error has the same shape. `code` is stable and meant for the frontend's logic. `message` is ready to display. `errors` appears on validation failures and maps each form field to its message.

```json
{
  "message": "Please correct the highlighted fields.",
  "code": "VALIDATION_ERROR",
  "errors": {
    "email": "Please enter a valid email address.",
    "password": "Password must be at least 8 characters long."
  }
}
```

| Status | `code` values | Meaning / what the frontend should do |
| ------ | ------------- | ------------------------------------- |
| 400 | `VALIDATION_ERROR`, `INVALID_ID`, `INVALID_JSON`, `INCORRECT_PASSWORD`, `INVALID_VERIFICATION_TOKEN`, `VERIFICATION_TOKEN_EXPIRED`, `INVALID_RESET_TOKEN`, `RESET_TOKEN_EXPIRED`, `INVALID_FILE`, `CANNOT_DELETE_SELF` | Show `message` and the per-field `errors` |
| 401 | `AUTH_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_REVOKED` | Session is over: clear the token and go to the login page |
| 401 | `INVALID_CREDENTIALS` | Only from `/auth/login`: wrong email or password. Stay on the login page |
| 403 | `EMAIL_NOT_VERIFIED` | Offer to resend the verification email |
| 403 | `FORBIDDEN`, `CANNOT_DELETE_ADMIN` | The role is not allowed to do this |
| 404 | `NOT_FOUND`, `BOOK_NOT_FOUND`, `NOT_IN_LIBRARY`, `PDF_MISSING`, `USER_NOT_FOUND`, `REVIEW_NOT_FOUND`, `NOTIFICATION_NOT_FOUND` | The item does not exist |
| 409 | `EMAIL_TAKEN`, `ALREADY_IN_LIBRARY`, `BOOK_IN_LIBRARIES`, `DUPLICATE`, `CONFLICT` | Conflicts with existing data |
| 413 | `FILE_TOO_LARGE`, `PAYLOAD_TOO_LARGE` | The uploaded file or the request body is over the limit |
| 429 | `RATE_LIMITED` | Too many attempts on `/auth`; wait and retry |
| 502 | `PDF_UNAVAILABLE`, `PDF_INVALID`, `PDF_TOO_LARGE` | The book's PDF could not be loaded from its source |
| 500 | `SERVER_ERROR` | Unexpected error; show a generic message |

**Objects returned by the API**

```jsonc
// User
{ "id": 4, "name": "Bob Stone", "email": "bob@example.com", "role": "user",
  "isVerified": true, "createdAt": "…", "updatedAt": "…" }

// Book
{ "id": 5, "title": "Dracula", "author": "Bram Stoker", "description": "…",
  "genre": "Horror",
  "averageRating": 4.5, "ratingCount": 2,
  "coverImageUrl": "https://covers.openlibrary.org/b/isbn/9780141439846-L.jpg",
  "pdfUrl": "https://www.planetebook.com/free-ebooks/dracula.pdf",
  "hasPdf": true, "publicationYear": 1897, "createdAt": "…", "updatedAt": "…" }

// Library entry (one book in a reader's library)
{ "id": 9, "bookId": 5, "readingStatus": "reading", "currentPage": 7, "totalPages": 100,
  "progressPercent": 7, "createdAt": "…", "updatedAt": "…", "book": { /* Book */ } }
```

`readingStatus` is one of `to_read`, `reading`, `read` (shown as To Read, Reading, Read). `currentPage` is `0` when the reader has not started the book.

---

## Health

### `GET /health` — public

```json
{ "status": "ok", "database": "connected" }
```

Returns 503 with `"database": "unreachable"` if PostgreSQL is down.

---

## Authentication

All `/auth` routes are public and rate-limited (20 requests per 15 minutes per IP by default).

### `POST /auth/register`

Creates an unverified reader account and emails a verification link.

```json
{ "name": "Bob Stone", "email": "bob@example.com", "password": "BobPass123" }
```

Rules: name 2–100 characters; valid email (stored in lowercase); password at least 8 characters with at least one letter and one number.

**201**
```json
{
  "message": "Your account has been created. We sent a verification link to bob@example.com.",
  "emailSent": true,
  "user": { "id": 4, "name": "Bob Stone", "email": "bob@example.com", "role": "user", "isVerified": false, "createdAt": "…", "updatedAt": "…" }
}
```

If `emailSent` is `false`, the account exists but the email failed; offer "Resend verification email". Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN`.

### `POST /auth/verify-email`

The email link opens the frontend at `/verify-email?token=<64 hex characters>`. The page sends that token here.

```json
{ "token": "3f9a…c21e" }
```

**200**
```json
{
  "message": "Your email address is verified. You can now log in.",
  "purpose": "signup",
  "user": { "id": 4, "isVerified": true, "…": "…" }
}
```

`purpose` is `"signup"` for a new account, or `"email-change"` when the user confirms a new address (message: "Your new email address is confirmed."). A token works once and expires after 24 hours.

Errors:
- 400 `INVALID_VERIFICATION_TOKEN`: unknown or already used.
- 400 `VERIFICATION_TOKEN_EXPIRED`: offer to resend.
- 409 `EMAIL_TAKEN`: the new address was taken in the meantime.

### `POST /auth/resend-verification`

```json
{ "email": "bob@example.com" }
```

**200**, always the same message so the endpoint cannot reveal which emails have accounts:
```json
{ "message": "If an unverified account exists for this email, a new verification link is on its way." }
```

A new email is sent at most once per minute per account. The previous link stops working.

### `POST /auth/login`

```json
{ "email": "bob@example.com", "password": "BobPass123" }
```

**200**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "expiresAt": "2026-11-05T13:58:19.000Z",
  "user": { "id": 4, "name": "Bob Stone", "email": "bob@example.com", "role": "user", "isVerified": true, "createdAt": "…", "updatedAt": "…" }
}
```

Use `user.role` to redirect: `admin` to the admin dashboard, `user` to the reader dashboard.

Errors:
- 401 `INVALID_CREDENTIALS`: the same message whether the email or the password is wrong.
- 403 `EMAIL_NOT_VERIFIED`

---

### `POST /auth/forgot-password`

Body: `{ "email": "bob@example.com" }`. Emails a link to `<CLIENT_URL>/reset-password?token=…`, valid for 60 minutes and usable once. A new link is sent at most once a minute per account.

**200** `{ "message": "If an account exists for bob@example.com, we sent it a link to choose a new password. …" }`, the same answer whether or not the account exists.

### `POST /auth/reset-password`

Body: `{ "token": "<64 hex characters from the link>", "password": "NewPass456" }`. The password follows the registration rules.

**200** `{ "message": "Your password has been changed. You can now log in with your new password." }`

Every login token issued before the reset stops working (the user is signed out everywhere). Opening the emailed link also proves the address, so an unverified account becomes verified.

Errors: 400 `INVALID_RESET_TOKEN` (unknown or already used), 400 `RESET_TOKEN_EXPIRED`, 400 `VALIDATION_ERROR` (weak password).

## Profile — *Any*

### `GET /profile`

Also the way to restore a session when the app loads: if it fails with 401, the stored token is no longer valid.

**200**
```json
{
  "user": { "id": 4, "name": "Bob Stone", "email": "bob@example.com", "role": "user", "isVerified": true, "createdAt": "…", "updatedAt": "…" },
  "pendingEmail": null
}
```

`pendingEmail` is the new address waiting for confirmation, if the user asked to change it.

### `PATCH /profile`

Send the fields to change. Changing the email requires the current password.

```json
{ "name": "Bob A. Stone" }
```
```json
{ "email": "bob.new@example.com", "currentPassword": "BobPass123" }
```

**200**
```json
{
  "user": { "…": "…", "email": "bob@example.com" },
  "pendingEmail": "bob.new@example.com",
  "message": "We sent a confirmation link to bob.new@example.com. Your email address will change once you confirm it.",
  "emailSent": true
}
```

The email only changes after the link sent to the new address is opened (`POST /auth/verify-email`, `purpose: "email-change"`). Until then the user keeps logging in with the old address. `emailSent` is `null` when no email change was requested.

Errors:
- 400 `VALIDATION_ERROR`: includes a missing `currentPassword` for an email change.
- 400 `INCORRECT_PASSWORD`
- 409 `EMAIL_TAKEN`

### `PUT /profile/password`

```json
{ "currentPassword": "BobPass123", "newPassword": "NewPass456" }
```

**200**
```json
{
  "message": "Your password has been changed. Other devices have been signed out.",
  "token": "eyJ…",
  "expiresAt": "…",
  "user": { "…": "…" }
}
```

**Replace the stored token with the new one**: the old token stops working. Errors: 400 `VALIDATION_ERROR` (weak, or same as the current password), 400 `INCORRECT_PASSWORD`.

---

## Books

### `GET /books` — *Any*

Query parameters, all optional:

| Parameter | Default | Description |
| --------- | ------- | ----------- |
| `search` | | Matches title or author, case-insensitive, partial |
| `genre` | | Exact genre name, case-insensitive (see `GET /genres`) |
| `sort` | `newest` | `newest`, `oldest`, `title`, `author`, `year`, `rating` |
| `page` | `1` | Page number |
| `limit` | `12` | Books per page, 1–50 |

Example: `GET /books?search=bronte&genre=Romance&sort=title&page=1&limit=12`

**200**
```json
{
  "books": [ { "id": 10, "title": "Alice's Adventures in Wonderland", "author": "Lewis Carroll", "…": "…" } ],
  "pagination": { "page": 1, "limit": 12, "total": 10, "totalPages": 1 }
}
```

### `GET /books/:id` — *Any*

A reader gets their own library entry for the book, or `null`:
```json
{
  "book": { "id": 5, "title": "Dracula", "…": "…" },
  "libraryEntry": { "id": 9, "bookId": 5, "readingStatus": "reading", "currentPage": 7, "totalPages": 100, "progressPercent": 7, "createdAt": "…", "updatedAt": "…" }
}
```

An admin gets how many readers have the book instead:
```json
{ "book": { "…": "…" }, "readerCount": 2 }
```

Errors: 400 `INVALID_ID`, 404 `BOOK_NOT_FOUND`.

### `GET /books/:id/pdf` — *Any*

Returns the PDF file itself (`Content-Type: application/pdf`). The API downloads it from the book's `pdfUrl` and passes it on, which avoids the browser's CORS restrictions on external PDF links. The `Authorization` header is required, so pass it to the PDF library. With React-PDF:

```jsx
<Document file={{ url: `${API_URL}/books/${id}/pdf`, httpHeaders: { Authorization: `Bearer ${token}` } }} />
```

Errors (JSON):
- 404 `PDF_MISSING`: the book has no PDF.
- 502 `PDF_UNAVAILABLE`: the source is unreachable or returned an error.
- 502 `PDF_INVALID`: the link is not a PDF.
- 502 `PDF_TOO_LARGE`: over 100 MB.

### `POST /books` — *Admin*

```json
{
  "title": "Frankenstein",
  "author": "Mary Shelley",
  "description": "Victor Frankenstein gives life to a creature…",
  "genre": "Science Fiction",
  "coverImageUrl": "https://covers.openlibrary.org/b/isbn/9780141439471-L.jpg",
  "pdfUrl": "https://www.planetebook.com/free-ebooks/frankenstein.pdf",
  "publicationYear": 1818
}
```

Required: `title`, `author` (up to 255 characters each) and `genre` (a name from `GET /genres`). Optional:
- `description`: up to 5000 characters.
- `coverImageUrl` and `pdfUrl`: must start with `http://` or `https://`.
- `publicationYear`: from 1 to next year.

Empty strings are stored as `null`, and numbers may be sent as strings.

**201** `{ "book": { … }, "message": "\"Frankenstein\" has been added to the catalogue." }`. Errors: 400 `VALIDATION_ERROR`.

### `PUT /books/:id` — *Admin*

Same body and rules as `POST /books`. Send every field: a missing optional field is cleared.

**200** `{ "book": { … }, "message": "\"Frankenstein\" has been updated." }`. Errors: 400, 404 `BOOK_NOT_FOUND`.

### `DELETE /books/:id` — *Admin*

If readers have the book in their library, the first call is refused so the admin can confirm:

**409**
```json
{
  "message": "\"Dracula\" is in 2 readers' libraries. Deleting it will also remove it from there, including reading progress.",
  "code": "BOOK_IN_LIBRARIES",
  "readerCount": 2
}
```

After confirmation, call `DELETE /books/:id?force=true`.

**200** `{ "message": "\"Dracula\" has been deleted.", "removedFromLibraries": 2 }`

---

## Personal library — *Reader*

Each reader only ever sees and changes their own library; the user is always taken from the token.

### `GET /library?status=`

`status` is optional: `to_read`, `reading` or `read`. Most recently updated first.

**200**
```json
{
  "items": [
    { "id": 9, "bookId": 5, "readingStatus": "reading", "currentPage": 7, "totalPages": 100, "progressPercent": 7,
      "createdAt": "…", "updatedAt": "…", "book": { "id": 5, "title": "Dracula", "…": "…" } }
  ],
  "counts": { "total": 1, "toRead": 0, "reading": 1, "read": 0 }
}
```

`counts` always covers the whole library, whatever the filter, so it can feed the tab labels and the reader dashboard.

### `POST /library`

```json
{ "bookId": 10, "readingStatus": "to_read" }
```

`readingStatus` is optional (default `to_read`). **201** `{ "entry": { … }, "message": "Book added to your library." }`

Errors:
- 404 `BOOK_NOT_FOUND`
- 409 `ALREADY_IN_LIBRARY`

### `PATCH /library/:bookId`

```json
{ "readingStatus": "read" }
```

**200** `{ "entry": { … }, "message": "Reading status updated." }`. Errors: 404 `NOT_IN_LIBRARY`.

### `DELETE /library/:bookId`

**200** `{ "message": "Book removed from your library." }`. Errors: 404 `NOT_IN_LIBRARY`.

---

## Reading progress — *Reader*

### `GET /library/:bookId/progress`

Works for any book in the catalogue, even one not in the library yet.

**200**
```json
{
  "progress": {
    "bookId": 5, "inLibrary": true, "readingStatus": "reading",
    "currentPage": 7, "totalPages": 100, "progressPercent": 7, "updatedAt": "…"
  }
}
```

For a book never opened: `inLibrary: false`, `currentPage: 0`, `totalPages: null`.

### `PUT /library/:bookId/progress`

```json
{ "currentPage": 8, "totalPages": 100 }
```

`currentPage` is required (at least 1). `totalPages` is optional after the first save; send it once the PDF has loaded.

**200** `{ "progress": { … }, "message": "Progress saved." }`

Saving also updates the library automatically:
- A book not in the library yet is added with status `reading`.
- A `to_read` book becomes `reading`.
- Reaching the last page marks the book as `read`.

Errors:
- 400 `VALIDATION_ERROR`: includes a page beyond `totalPages`.
- 404 `BOOK_NOT_FOUND`

### Suggested reader flow

1. `GET /books/:id` gives the title and `hasPdf`. If `hasPdf` is false, show "No PDF available".
2. `GET /library/:bookId/progress` gives the start page: `Math.max(1, progress.currentPage)`.
3. Open `GET /books/:id/pdf` in the PDF viewer at that page. Read `numPages` once the document loads.
4. Save automatically when the page changes, waiting about 1 second after the last change so quick page flips are not all sent: `PUT /library/:bookId/progress` with `{ currentPage, totalPages: numPages }`.
5. A "Save progress" button calls the same endpoint immediately.

---

## Admin dashboard — *Admin*

### `GET /admin/stats`

**200**
```json
{
  "totals": {
    "books": 10, "booksWithPdf": 10, "genres": 5,
    "users": 4, "readers": 3, "verifiedReaders": 3, "admins": 1,
    "readersJoinedLast30Days": 3, "libraryEntries": 4
  },
  "readingStatus": { "toRead": 0, "reading": 3, "read": 1 },
  "libraryUpdatesLast7Days": 4,
  "booksByGenre": [ { "name": "Horror", "count": 3 } ],
  "recentBooks": [ { /* Book */ } ],
  "recentReaders": [ { /* User */ } ],
  "popularBooks": [ { /* Book */, "readerCount": 2 } ]
}
```

`recentBooks`, `recentReaders` and `popularBooks` hold up to 5 items each. `popularBooks` lists the books found in the most libraries.

### `GET /admin/users?search=&role=&page=&limit=`

Every account, newest first. All query parameters are optional:

| Parameter | Default | Description |
| --------- | ------- | ----------- |
| `search`  |         | Matches the name or email, case-insensitive, partial |
| `role`    |         | `user` or `admin` |
| `page`    | `1`     | Page number |
| `limit`   | `20`    | Accounts per page, 1–50 |

**200**
```json
{
  "users": [
    { "id": 6, "name": "Achref Trabelsi", "email": "achref@example.com", "role": "user", "isVerified": true,
      "createdAt": "…", "updatedAt": "…", "libraryCount": 2 }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

`libraryCount` is the number of books on that person's shelves.

### `DELETE /admin/users/:id`

Deletes a reader's account. Their library entries, reading progress and verification links are deleted with it, and their login token stops working immediately.

**200** `{ "message": "Achref Trabelsi's account has been deleted.", "removedLibraryEntries": 2 }`

Only reader accounts can be deleted, so the library always keeps an administrator.

Errors:
- 400 `CANNOT_DELETE_SELF`: an admin tried to delete their own account.
- 403 `CANNOT_DELETE_ADMIN`: the account belongs to an administrator.
- 404 `USER_NOT_FOUND`
- 400 `INVALID_ID`

## Genres — *Any*

### `GET /genres`

The 12 genres, with how many books each has. `POST /books` and `PUT /books/:id` require a `genre` field with one of these names, otherwise they answer 400 with `errors.genre`.

```json
{ "genres": [ { "id": 3, "name": "Biography", "count": 0 }, { "id": 2, "name": "Fantasy", "count": 1 } ] }
```

## Ratings and reviews

Every book carries `averageRating` (one decimal, `null` when nobody has rated it) and `ratingCount`, calculated from the reviews table.

### `GET /books/:id/reviews` — *Any*

```json
{
  "summary": { "averageRating": 4.5, "ratingCount": 2, "distribution": { "5": 1, "4": 1, "3": 0, "2": 0, "1": 0 } },
  "reviews": [ { "id": 7, "bookId": 5, "userId": 4, "userName": "Bob Stone", "rating": 5,
                 "comment": "Loved it.", "createdAt": "…", "updatedAt": "…" } ],
  "myReview": null
}
```

### `POST /books/:id/reviews` — *Reader*

Body: `{ "rating": 4, "comment": "Optional, up to 2000 characters" }`. **201** `{ review, summary, message }`.
One review per reader per book: a second one answers 409 `REVIEW_EXISTS`. Every admin gets a `new_review` notification, for example `Asma Ameur rated "Dracula" 4 stars. “Loved the atmosphere.”`.

### `PUT /reviews/:id` — *Reader, own review only*

Same body. **200** `{ review, summary, message }`. Another reader's review answers 403 `FORBIDDEN`; 404 `REVIEW_NOT_FOUND`.

### `DELETE /reviews/:id` — *Reader (own review) or Admin (any review)*

Readers can delete their own review only (another reader's answers 403 `FORBIDDEN`).

Admins can delete any review (moderation). Optional body: `{ "reason": "Reviews must be about the book." }` (up to 500 characters). The author gets a `review_removed` notification, including the reason when one is given.

**200** `{ summary, message }`. 404 `REVIEW_NOT_FOUND`.

## Notifications — *Any*

Notifications are stored in the database, so they are waiting after being offline. Each user only sees and changes their own.

| `type` | Who receives it | When |
| ------ | --------------- | ---- |
| `new_book` | Every reader | An admin adds a book (`POST /books` returns `notifiedReaders`) |
| `new_review` | Every admin | A reader posts a rating (`POST /books/:id/reviews`). Editing a review does not notify again |
| `review_removed` | The review's author | An admin deletes their review (`DELETE /reviews/:id`), with the reason if given |

The notification is saved in the same transaction as the book or the review.

### `GET /notifications?limit=&unread=`

`limit` 1–50 (default 20); `unread=true` returns unread ones only. Newest first.

```json
{
  "notifications": [
    { "id": 12, "type": "new_book", "message": "New in the catalogue: \"Dracula\" by Bram Stoker.",
      "isRead": false, "createdAt": "…",
      "book": { "id": 5, "title": "Dracula", "author": "Bram Stoker", "coverImageUrl": "https://…" } }
  ],
  "unreadCount": 1
}
```

### `GET /notifications/unread-count`

`{ "unreadCount": 1 }`. The navbar bell polls it every 20 seconds and when the tab is refocused.

### `PATCH /notifications/:id/read`

**200** `{ "unreadCount": 0 }`. 404 `NOTIFICATION_NOT_FOUND` (also for another reader's notification).

### `PATCH /notifications/read-all`

**200** `{ "updated": 3, "unreadCount": 0 }`

## Favourite genres and recommendations — *Reader*

### `GET /preferences/genres`

`{ "genres": ["Fantasy", "Mystery"] }`

### `PUT /preferences/genres`

Body: `{ "genres": ["Fantasy", "Mystery"] }` replaces the whole set (an empty list clears it). Unknown names answer 400 with `errors.genres`.

### `GET /recommendations?limit=`

`limit` 1–24 (default 6). Each book is scored from the reader's favourite genres (strongest), the genres on their shelves, their own ratings (high ratings raise a genre, low ones lower it) and the book's average rating. Books they have read, are reading or have reviewed come last, and books already on their To Read shelf come just before those.

```json
{
  "books": [ { "id": 5, "title": "Dracula", "genre": "Horror", "…": "…",
               "recommendation": { "reason": "Because you like Horror", "matchesPreferences": true, "alreadyInLibrary": false } } ],
  "preferredGenres": ["Horror"],
  "hasPreferences": true,
  "hasHistory": true
}
```

## File uploads — *Admin*

Covers and PDFs can be uploaded instead of linking to another website. Send the file itself as the request body, with its type as `Content-Type`. The answer's `url` goes into the book's `coverImageUrl` or `pdfUrl`, like any link.

| Route | Accepted `Content-Type` | Limit |
| ----- | ------------------------ | ----- |
| `POST /uploads/cover` | `image/jpeg`, `image/png`, `image/webp` | 5 MB |
| `POST /uploads/pdf` | `application/pdf` | 100 MB |

**201** `{ "url": "http://localhost:4000/uploads/covers/3f2a…9c.jpg", "size": 48213, "message": "File uploaded." }`

- The file's first bytes are checked, so a renamed file is refused (400 `INVALID_FILE`). Too large: 413 `FILE_TOO_LARGE`.
- Files are stored in `backend/uploads/` (ignored by git) with random names.
- Covers are public at `/uploads/covers/…`. Uploaded PDFs are not public: readers open them through `GET /books/:id/pdf`, behind login.
- When a book is edited or deleted, the uploaded files it no longer uses are deleted, unless another book uses them.
