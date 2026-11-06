# BookTracker — Frontend

React single-page application for BookTracker: the public site, the reader's space (catalogue, personal library, PDF reader) and the administration area. It talks to the Express API in [`../backend`](../backend); every endpoint it uses is described in [`../backend/API.md`](../backend/API.md).

## Requirements

- **Node.js 20.19 or newer** (required by Vite 7)
- The backend running and reachable (by default at `http://localhost:4000/api`)

## Getting started

```bash
cd frontend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Open <http://localhost:5173>.

- **Backend address.** If the backend runs somewhere else, change `VITE_API_URL` in `.env`.
- **CORS.** The backend's `CLIENT_URL` must be the address of this app (`http://localhost:5173`), otherwise the browser blocks the requests.

| Command           | What it does                                           |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Development server with instant reload                 |
| `npm run build`   | Production build in `dist/`                            |
| `npm run preview` | Serves the production build locally to check it        |

## Stack

React 18 · Vite 7 · React Router 6 · React-PDF 10 (PDF.js) · Lucide icons · plain CSS with custom properties · fonts self-hosted with Fontsource (Cormorant Garamond, Jost).

## Pages

| Area   | Route                       | Page                                                |
| ------ | --------------------------- | --------------------------------------------------- |
| Public | `/`                         | Landing page                                        |
|        | `/login`, `/register`       | Log in, create an account                           |
|        | `/check-email`              | Email verification: "check your inbox" and resend   |
|        | `/verify-email?token=…`     | Verification result (the link in the email)         |
| Reader | `/app`                      | Dashboard: continue reading, shelf counts, new books |
|        | `/app/catalogue`            | Search, filter by category, sort, add to library    |
|        | `/app/books/:id`            | Book details, reading status, progress              |
|        | `/app/library`              | My Library with To Read / Reading / Read tabs       |
|        | `/app/read/:id`             | PDF reader                                          |
|        | `/app/profile`              | Profile                                             |
| Admin  | `/admin`                    | Dashboard with catalogue and reader statistics      |
|        | `/admin/books`              | Catalogue management (search, filter, edit, delete) |
|        | `/admin/books/new`          | Add a book                                          |
|        | `/admin/books/:id`          | Book details for admins                             |
|        | `/admin/books/:id/edit`     | Edit a book                                         |
|        | `/admin/books/:id/read`     | PDF preview (progress is not saved)                 |
|        | `/admin/users`              | Readers: list, search and delete reader accounts    |
|        | `/admin/profile`            | Profile                                             |

Reader routes are only shown to `user` accounts and admin routes to `admin` accounts (`components/layout/RouteGuards.jsx`). This only controls what is displayed: the backend checks the same rules again on every request.

## Project structure

```text
src/
├── api/            client.js (fetch wrapper, token, errors) and index.js (one function per endpoint)
├── context/        AuthContext (session), ThemeContext (light/dark), ToastContext (notifications)
├── hooks/          useApi (loading/error/data), useBookQuery (filters in the URL), small helpers
├── components/
│   ├── layout/     App shell with sidebar, public header/footer, auth layout, route guards
│   ├── ui/         Button, form fields, modal, loading/empty/error states, badges, pagination
│   ├── books/      Cover, card, filters, status picker, delete dialog
│   └── charts/     Segmented bar and ranked bars for the admin dashboard
├── pages/          public/, reader/, admin/, shared/ (profile, PDF reader)
├── styles/         tokens.css (design tokens and themes), base, components, layout, pages
└── utils/          Formatting and labels
```

## How it works

### Login session

`POST /auth/login` returns a token, which is kept in `localStorage` with its expiry date and sent as `Authorization: Bearer …` with every request (`api/client.js`).

The user is logged out automatically in three cases:
- the token expires;
- the API answers that the session is no longer valid, for example after a password change on another device;
- the user logs out in another browser tab.

### Theme

Light and dark themes are defined once, as CSS variables in `styles/tokens.css`. The choice is saved in `localStorage` (`booktracker.theme`).

It is applied by a small script in `index.html` before the page draws, so it never flashes. Without a saved choice, the app follows the operating system's setting.

### PDF reader

**Loading the book.**
- The PDF is downloaded through `GET /api/books/:id/pdf`, with a progress bar, and rendered with PDF.js.
- PDF.js is only loaded when the reader opens, so other pages stay light.
- A missing PDF, an unreachable link or a damaged file each get their own message.

**Saving your place.**
- The page opens where the reader stopped.
- The page number is saved about a second after the reader stops turning pages, again when they leave the page or close the tab, and with the "Save progress" button.

**Controls.**
- Arrow keys or Page Up/Down turn pages, and `+` / `-` zoom.

### Responsive layout

| Width                       | Navigation                                     |
| --------------------------- | ---------------------------------------------- |
| 1100 px and wider           | Full sidebar                                   |
| 768 px to 1099 px           | Compact icon sidebar                           |
| Below 768 px                | Menu button that opens a drawer                |

On small screens:
- the admin catalogue table becomes one card per book;
- the reader's toolbar keeps only its icons.

Every page has been checked at 1440, 1024, 768, 390 and 320 px.

## Design system: "Literary Luxury"

| Token          | Light                 | Dark                   |
| -------------- | --------------------- | ---------------------- |
| Background     | Ivory `#F5F0E6`       | Deep forest `#0E1B17`  |
| Primary        | Forest green `#183D32`| Lighter forest `#2F6A55` |
| Accent         | Muted gold `#C5A46D`  | Muted gold `#C5A46D`   |
| Text           | `#1D2722`             | Soft ivory `#EDE6D6`   |

- **Typography:** Cormorant Garamond for titles, Jost for interface text and numbers.
- **Reading-status colours** (To Read gold, Reading blue, Read green) were checked to stay distinguishable for colour-blind readers, in both themes.
- **Status is never shown by colour alone:** it always comes with its name.
