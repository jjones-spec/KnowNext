# KnowNext — Vanilla LMS Prototype

High-fidelity frontend prototype for an adaptive-learning LMS.

## Run

Open `index.html` directly or serve the folder with any basic static server.

## Demo accounts

- Student: `student123` / `student123`
- Teacher: `teacher123` / `teacher123`
- Admin: `admin123` / `admin123`
- Superadmin: `superadmin123` / `superadmin123`

## Stack

- HTML
- CSS
- Vanilla JavaScript
- localStorage
- Inline SVG/vector illustrations

No backend, React, Next.js, Vue, Angular, Tailwind, Bootstrap, or chart library is required.

## System architecture

KnowNext is a client-side, single-page learning management system (LMS) prototype. It runs entirely in the browser: there is no application server, API, remote database, or server-side authentication. Serve the project directory as static files, or open `index.html` directly.

```text
                         ┌────────────────────────────────────────────┐
                         │                Browser                     │
                         │                                            │
 [Open app] ────────────>│ index.html                                 │
                         │   ├── css/style.css (visuals + responsive) │
                         │   ├── assets/knownext-logo.png             │
                         │   └── Load JavaScript in order:            │
                         │       1. js/data.js (demo + seed content)  │
                         │       2. js/store.js (state + persistence) │
                         │       3. js/app.js (UI + routing + actions)│
                         └───────────────────┬────────────────────────┘
                                             │
                                             v
                              [Load state from localStorage]
                                  │                    │
                      missing/invalid                  valid
                                  │                    │
                                  v                    │
                    [Build seed data and progress]     │
                                  │                    │
                                  └─────────┬──────────┘
                                            v
                                  [Restore demo session]
                                      │             │
                                  signed out      signed in
                                      │             │
                                      v             v
                                   [Login]   [Choose role navigation]
                                      │             │
                          invalid credentials      │
                              ┌───────┘             │
                              v                     v
                           [Login]       [Render selected page]
                                                   │
                                                   v
                                     [Delegated UI actions]
                                                   │
                                                   v
                                      [Update in-memory state]
                                                   │
                                                   v
                                  [Save shared state to localStorage]
                                      │                    │
                                      v                    v
                            [Refresh current view]  [Other tabs receive
                                      │               storage event and refresh]
                                      └──────> [Role-based app pages]
                                                   │
                         ┌─────────────────────────┴──────────────────┐
                         v                                            v
                  [Reset demo data]                                [Log out]
                         │                                            │
                         └──> [Rebuild seed state]                    └──> [Clear
                                                                       session/view
                                                                           │
                                                                           v
                                                                        [Login]
```

### Runtime and data flow

1. The browser loads `index.html`, then the seed data, persistence helpers, and application code in that order.
2. `store.js` loads `knownext_state` from localStorage. On a first run (or when stored data has an unsupported version), it builds the initial state from the seed data in `data.js`. Missing or malformed fields are restored from the seed shape while valid saved fields are retained.
3. `app.js` restores the demo session from `knownext_session`, initializes demo mastery, and renders either the login page or the signed-in application shell. A saved view is restored from sessionStorage when available.
4. Each screen is rendered into the page by role-aware JavaScript render functions. The active role determines the sidebar navigation and the renderer for role-specific views.
5. Controls use delegated `data-action`, `data-input`, and `data-change` handlers in `app.js`. Mutations update the shared in-memory state, save it to localStorage, and refresh the relevant view. A browser storage event refreshes an open app when another tab changes shared state.
6. Logging out removes the saved session and view; **Reset demo data** rebuilds the seeded state and randomized demo progress.

### Browser storage

| Storage key | Purpose |
| --- | --- |
| `knownext_state` (localStorage) | Shared LMS records and settings, including courses, lesson progress, tasks, classes, assignments, submissions, assessments, attempts, announcements, institutions, administrator accounts, profiles, notifications, and audit logs. |
| `knownext_session` (localStorage) | Current demo username and role. |
| `knownext_demo_progress` (localStorage) | Randomized example mastery scores and course progress. |
| `knownext_view` (sessionStorage) | Current view and view parameters for the browser tab. |

The seeded and user-edited state is shared by all demo accounts in the same browser profile; accounts are not isolated tenants. Clearing browser storage removes saved prototype changes.

### Main modules

- **`index.html`** is the static application entry point and loads the CSS and JavaScript; it contains no application framework.
- **`js/data.js`** defines the demo login records and example curriculum/activity data, including courses, modules, lessons, learner roster, assignments, submissions, assessments, classes, tasks, notifications, and activity.
- **`js/store.js`** owns state seeding and versioning, date/ID helpers, assessment grading helpers, demo mastery, localStorage persistence, and login-session persistence. Its `seedState()` function is the schema-by-example for the prototype’s shared records.
- **`js/app.js`** owns runtime UI state, role checks, view routing/rendering, forms and validation, event delegation, and feature actions. It is the UI/controller layer and calls the store helpers for persistence.
- **`css/style.css`** contains the visual system and responsive rules for login, dashboard, learning, administration, tables, forms, modals, and navigation.
- **`assets/knownext-logo.png`** is the logo used by the shared login and application shell.

### Feature areas

The role-specific navigation exposes learning dashboards, courses and lessons, learning paths, study plans, virtual classes, assessments and attempts, assignments and grading, announcements, calendars, profiles/settings, and analytics. Institution administrators additionally have institution-level people, course, enrollment, calendar, class, announcement, settings, and reporting views. The platform superadmin has institution and administrator management, a user directory, global analytics, audit logs, platform announcements, and platform settings.

### Prototype security and production boundary

This is demo-only authentication, not production security. Demo credentials are defined in client-delivered JavaScript, and password changes are stored in browser localStorage in plain text. Client-side role checks and UI navigation are not authorization boundaries. A production system would need a server-side identity provider, authorization checks, validated API endpoints, and a server-managed database; none are part of this prototype.

## User tree

The prototype has four sign-in roles. The platform-level and institution-level relationships represented by its seeded records are:

```text
KnowNext platform
└── Superadmin — Ariana Dela Cruz (superadmin123)
    ├── Platform-wide institution, administrator, user-directory,
    │   analytics, audit-log, announcement, and settings views
    └── Institutions
        ├── Northfield Academy (active)
        │   └── Admin — Elena Ramos (admin123)
        ├── Southview Learning Center (active)
        │   └── No administrator assigned in the seed data
        └── Lakeside International School (inactive)
            └── No administrator assigned in the seed data
```

The remaining seeded sign-in accounts and learner roster are:

```text
Learning workspace demo accounts
├── Teacher — Prof. Maria Santos (teacher123)
│   └── Department: Senior High School
└── Student — Alex Cruz (student123)
    └── Senior High School · Grade 12 · roster student ID 1

Seed learner roster (sample records, not separate login accounts)
├── Alex Cruz       (ID 1)
├── Jamie Santos    (ID 2)
├── Miguel Reyes    (ID 3)
├── Sofia Garcia    (ID 4)
├── Noah Mendoza    (ID 5)
└── Bea Torres      (ID 6)
```

Only the admin-to-institution assignment is explicitly stored for these relationships (`institutionId` / `assignedAdmin`). The demo teacher and student are standalone role accounts; they do not have institution IDs or enforced membership links. The other roster entries are sample learner records, not accounts that can sign in. The tree therefore describes the prototype’s seeded data and intended role scopes, not a production tenant or permission hierarchy.

### Role workflows

The following Markdown diagrams summarize the available workflows for each seeded role. Updates are saved to the same browser-local demo state.

#### Student — Alex Cruz

```text
[Log in]
   |
   v
[Student dashboard]
   |
   +--> [My courses] --> [Open course / study lesson] --> [Save progress / bookmark] --+
   +--> [Learning path] --> [Review mastery / next step] --> [Study plan / tasks] -----+
   +--> [Assessments] --> [Take assessment] --> [Save answers and result] --------------+
   +--> [Assignments] --> [Submit assignment] --> [Save submission] -------------------+--> [Shared demo state]
   +--> [Virtual classes] --> [Meeting link available?] -- yes --> [Open meeting]       |         |
   |                                        |-- no --> [Show missing-link message]     |         +--> [Dashboard]
   +--> [Calendar / announcements / AI tools / progress / profile] --------------------+               |
                                                                                                       v
                                                                                                   [Log out]
```

#### Teacher — Prof. Maria Santos

```text
[Log in]
   |
   v
[Teacher dashboard]
   |
   +--> [Courses / learning content] -----------------------------------------------+
   +--> [Students / learner progress] --> [Assign practice] ------------------------+
   +--> [Assessments] --> [Create / edit / publish] --> [Review attempts / results] -+
   +--> [Assignments] --> [Manage work] --> [Review submissions / grade / feedback]-+--> [Shared demo state]
   +--> [Virtual classes] --> [Schedule / edit / add meeting link] ------------------+         |
   +--> [Analytics / AI teaching tools / announcements / calendar / profile] ---------+         +--> [Dashboard]
                                                                                                      |
                                                                                                      v
                                                                                                  [Log out]
```

#### Admin — Elena Ramos

```text
[Log in]
   |
   v
[Institution overview: Northfield Academy]
   |
   +--> [Manage students and teachers] -------------------------+
   +--> [Manage subjects and courses] ---------------------------+
   +--> [Manage sections and enrollment] ------------------------+
   +--> [Academic calendar / virtual classes] -------------------+
   +--> [Assignments and assessments] ---------------------------+--> [Shared demo state]
   +--> [Reports and analytics] ---------------------------------+         |
   +--> [Institution announcements / settings] -----------------+         +--> [Overview]
   +--> [Profile and account settings] --------------------------+               |
                                                                                  v
                                                                              [Log out]
```

#### Superadmin — Ariana Dela Cruz

```text
[Log in]
   |
   v
[Platform overview]
   |
   +--> [Manage institutions] --> [Manage / assign institution admins] --+
   +--> [User directory] ------------------------------------------------+
   +--> [Global analytics] ----------------------------------------------+
   +--> [Audit logs] ----------------------------------------------------+--> [Shared demo state]
   +--> [Platform announcements] ----------------------------------------+         |
   +--> [Platform settings] ---------------------------------------------+         +--> [Overview]
                                                                                   |
                                                                                   v
                                                                               [Log out]
```

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
