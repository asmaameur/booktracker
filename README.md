# BookTracker

BookTracker is a digital library web application. Readers browse a book catalogue, build a personal library, track their reading status, and read PDF books directly in the browser with their progress saved automatically. Administrators manage the catalogue and follow activity from a dashboard.

## Features

**Readers**
- Register, verify their email address, and log in
- Browse and search the catalogue by title, author, or genre
- Add books to a personal library with a status: To Read, Reading, or Read
- Read PDFs in the built-in reader, with progress saved and resumed automatically
- Filter the catalogue by genre, rate books from 1 to 5 stars and write reviews
- Get notified in the app when a new book is added
- Choose favourite genres and get personalised recommendations on the dashboard
- Manage their profile (name, email, password)
- Reset a forgotten password with a link sent by email

**Administrators**
- Dashboard with catalogue and user statistics
- Add, edit, view, and delete books, uploading covers and PDFs or linking to them
- Remove inappropriate reviews (the author is told why)
- Manage their profile

## Tech stack

| Layer    | Technologies                                                                   |
| -------- | ------------------------------------------------------------------------------ |
| Frontend | React 18, Vite 7, React Router 6, React-PDF / PDF.js, CSS with light/dark themes |
| Backend  | Node.js 20+, Express 5, PostgreSQL (`pg`), JWT, bcryptjs, Nodemailer           |

## Repository structure

```text
booktracker/
├── backend/    Express REST API (MVC: models, views, controllers, middleware, routes)
├── frontend/   React + Vite single-page application
├── docs/       Project guide: how the whole app works, file by file
├── README.md
└── .gitignore
```

| Document                                       | What it covers                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| [backend/README.md](backend/README.md)         | Backend setup, environment variables, database, emails, security   |
| [backend/API.md](backend/API.md)               | Every endpoint, with request and response examples                 |
| [frontend/README.md](frontend/README.md)       | Frontend setup, pages, structure, design system                    |
| [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) | How the whole app works, and the file where each feature lives     |

## Getting started

You need **Node.js 20.19 or newer** and **PostgreSQL 13 or newer**. The backend and the frontend run side by side, each in its own terminal.

**1. Backend** (API on <http://localhost:4000/api>)

```bash
cd backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# then edit .env: DB_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:init             # creates the database and tables
npm run db:seed             # adds the sample books
npm run db:create-admin     # creates the admin account from .env
npm run dev
```

**2. Frontend** (app on <http://localhost:5173>), in a second terminal

```bash
cd frontend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Open <http://localhost:5173> and log in with the admin account from `backend/.env`, or register a reader account. While `SMTP_HOST` is empty in `backend/.env`, verification emails are not sent: they are printed in the backend terminal, and you open the link from there.

The default settings already match each other: the frontend calls `http://localhost:4000/api`, and the backend accepts requests from `http://localhost:5173`. Each step is explained in more detail in [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).

## Branch workflow

| Branch     | Purpose                                     | Owner        |
| ---------- | ------------------------------------------- | ------------ |
| `main`     | Stable, integrated application              | Shared       |
| `backend`  | Backend development (`backend/` folder)     | Asmaa Meur   |
| `frontend` | Frontend development (`frontend/` folder)   | Islem Hassin |

- Work on your own branch and inside your own folder.
- When a feature is stable, open a pull request into `main`. The other developer reviews it before merging.
- Pull `main` into your branch regularly to stay up to date with the other side of the project.
- Never commit `.env` files or secrets (database passwords, JWT secret, SMTP credentials). Share an `.env.example` with placeholder values instead.

## Team

- **Asmaa Meur**, backend developer ([@asmaameur](https://github.com/asmaameur))
- **Islem Hassin**, frontend developer ([@islem004](https://github.com/islem004))
