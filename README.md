# KnowNext — Vanilla LMS Prototype

High-fidelity frontend prototype for an adaptive-learning LMS.

## Run

Open `index.html` directly or serve the folder with any basic static server.

## Demo accounts

- Student: `student123` / `student123`
- Teacher: `teacher123` / `teacher123`

## Stack

- HTML
- CSS
- Vanilla JavaScript
- localStorage
- Inline SVG/vector illustrations

No backend, React, Next.js, Vue, Angular, Tailwind, Bootstrap, or chart library is required.

## Brand

**KnowNext** — *Study Smarter. Know What's Next.*

The prototype uses five general subjects and randomized demo mastery/progress values. Open Progress and choose “Randomize demo progress” to generate a fresh set of sample results.

## Demo data

- `js/data.js` holds the seed content; `js/store.js` copies it into `localStorage` (`knownext_state`) the first time the app loads. After that, every change made by either account — courses, lesson progress, tasks, classes, assignments, submissions, grades, assessment attempts, announcements, notifications, profile, settings — is saved there and shared by both demo accounts.
- Seed dates are relative to the day the data is created, so there are always upcoming items.
- Seeded live classes have **no meeting link**. Log in as the teacher, open a class, choose **Edit**, and paste a real Google Meet / Zoom / Teams URL to make **Join** work.
- Profile → Privacy & data → **Reset demo data** restores the original content (including passwords changed with the demo-only Change password form).

## UX/UI direction

The KnowNext visual system uses a consistent spacing scale, restrained blue/yellow color hierarchy, clearer typography levels, fewer competing card treatments, and subtle motion. SVG illustrations are used throughout the login, dashboard, teacher insights, and course cards so the prototype does not depend on external image assets.
