# BookTracker

BookTracker is a digital library web application. Readers browse a book catalogue, build a personal library, track their reading status, and read PDF books directly in the browser with their progress saved automatically. Administrators manage the catalogue and follow activity from a dashboard.

## Features

**Readers**
- Register, verify their email address, and log in
- Browse and search the catalogue by title, author, or category
- Add books to a personal library with a status: To Read, Reading, or Read
- Read PDFs in the built-in reader, with progress saved and resumed automatically
- Manage their profile (name, email, password)

**Administrators**
- Dashboard with catalogue and user statistics
- Add, edit, view, and delete books
- Manage their profile

## Tech stack

| Layer    | Technologies                                                                   |
| -------- | ------------------------------------------------------------------------------ |
| Frontend | React 18, Vite, React Router 6, React-PDF / PDF.js, CSS with light/dark themes |
| Backend  | Node.js 18+, Express, PostgreSQL (`pg`), JWT, bcryptjs, Nodemailer             |

## Repository structure

```text
booktracker/
├── backend/    Express REST API (MVC: models, controllers, routes, middleware, config)
├── frontend/   React + Vite single-page application
├── README.md
└── .gitignore
```

Each folder will have its own README with setup instructions, environment variables, and available scripts.

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
