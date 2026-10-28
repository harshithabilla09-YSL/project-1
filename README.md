# Campus Complaint and Grievance Management System

A beginner-friendly full-stack college mini-project built with **HTML, CSS, Vanilla JavaScript, Node.js, Express.js, and Supabase PostgreSQL**.

## 1. Project overview

Students need a clear way to report problems such as classroom equipment issues, cleanliness, transport, hostel concerns, or IT problems. This application lets a student create a complaint, receive a tracking code, and view its status. An administrator can review campus complaints and update their status.

### Problem statement
Campus complaints may be reported informally and can be difficult to track. This system organizes complaint submission and status tracking in one place.

### Objectives
- Provide a simple form for students to submit complaints.
- Generate a unique complaint tracking code.
- Store complaint records persistently in PostgreSQL.
- Let students view only their own complaints.
- Let authorized administrators review all complaints and update statuses.
- Provide search, filtering, and basic dashboard statistics.

## 2. Users and features

**Student**
- Create an account and log in with email and password.
- Submit a complaint with title, category, optional location, and description.
- View and search their own complaints.
- See complaint statuses: Submitted, In Progress, Resolved, or Rejected.

**Administrator**
- Review all complaints.
- Search/filter complaint records.
- Update a complaint status.

New sign-ups always receive the `student` role. An administrator must be promoted manually in Supabase by a trusted project owner. There is no public admin registration.

## 3. Technology stack

- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Node.js and Express.js
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth, called through backend endpoints
- Security packages: Helmet and express-rate-limit
- Version control: Git and GitHub

## 4. Folder structure

```text
campus-complaint-and-grievance-management-system/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── routes/
│   │   ├── auth.js
│   │   └── complaints.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   ├── supabase.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## 5. Prerequisites

Install these on your Windows computer:

- Node.js LTS: https://nodejs.org/
- Visual Studio Code: https://code.visualstudio.com/
- Git: https://git-scm.com/downloads
- A free Supabase account: https://supabase.com/

After installing Node.js, open a new terminal and run:

```bash
node --version
npm --version
git --version
```

Each command should print a version number. If a command is not recognized, install that tool and restart the terminal.

## 6. Create the Supabase database

1. Sign in at https://supabase.com/ and create a new project.
2. Save the database password somewhere private; this project does not need the database password in its `.env`.
3. Wait until the project finishes provisioning.
4. Open **SQL Editor** in the Supabase dashboard.
5. Open `database/schema.sql` from this repository, copy all of it into a new SQL query, and run it.
6. Open **Table Editor** and verify that `profiles` and `complaints` exist.
7. In **Project Settings / API** (the exact menu label can vary), copy the Project URL, publishable/anon key, and server-side service-role/secret key. The service-role key is privileged and must never be shared or placed in frontend files.

The schema creates:
- `profiles`: one application profile per Supabase Auth user, with a role.
- `complaints`: complaint content, owner, status, tracking code, and timestamps.

A database trigger automatically creates a student profile when a user registers.

## 7. Configure environment variables

Inside the `backend` directory, copy `.env.example` to a new file named `.env`.

On Windows PowerShell, from the project root:

```powershell
Copy-Item backend/.env.example backend/.env
```

Open `backend/.env` and replace the example values:

```dotenv
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_REAL_SUPABASE_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_REAL_SUPABASE_SERVICE_ROLE_OR_SECRET_KEY
```

Use the values from your own Supabase project. These example strings are placeholders and will not connect to a database. Keep `backend/.env` private. It is excluded from Git by `.gitignore`. The `.env.example` file contains names and placeholders only and should be committed.

## 8. Install dependencies and run the app

Open the project folder in VS Code. Choose **Terminal → New Terminal**. Run commands from the indicated directory.

From the project root:

```bash
cd backend
npm install
npm start
```

Expected terminal message:

```text
Campus Grievance app running at http://localhost:3000
Health check: http://localhost:3000/api/health
```

Open http://localhost:3000 in your browser. The health endpoint should return JSON similar to:

```json
{"status":"ok","service":"campus-grievance-api"}
```

Keep the terminal running while you use the app. To stop the server, press `Ctrl+C`.

For automatic server restart during development, use `npm run dev`.

## 9. Create an administrator account

1. Open the application and use **Create account** to register your own test account.
2. Confirm your email if Supabase requires it, then log in.
3. In Supabase, open **SQL Editor** and run the following query after replacing the email with your own exact account email:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where lower(email) = lower('your-test-email@example.com')
);
```

4. Check the query result and confirm one row was updated.
5. Log out of the app and log in again so the app reloads your role.

Only a trusted project owner should run this query. Do not create a public endpoint that allows users to change their own role.

## 10. How the application works

1. The browser sends registration/login requests to the Express API.
2. Supabase Auth checks credentials and issues an access token.
3. The browser sends that token as `Authorization: Bearer <token>` with protected API requests.
4. Express verifies the token with Supabase Auth and reads the user's role from `profiles`.
5. The backend checks permissions and reads/writes complaint records in Supabase PostgreSQL.
6. The frontend renders returned data safely and shows friendly success/error messages.

The Supabase service-role key is used only by backend code. Never add it to `frontend/app.js`, HTML, CSS, screenshots, or GitHub.

## 11. API endpoints

All endpoints use JSON unless stated otherwise.

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Check that the API is running | Public |
| POST | `/api/auth/signup` | Create an account | Public; rate-limited |
| POST | `/api/auth/login` | Log in and receive an access token | Public; rate-limited |
| GET | `/api/auth/me` | Return the current account and role | Signed-in user |
| GET | `/api/complaints` | List complaints; students get only their own | Signed-in user |
| POST | `/api/complaints` | Submit a complaint | Signed-in student |
| PATCH | `/api/complaints/:id/status` | Update a complaint status | Admin only |

### Example request: create a complaint

```json
{
  "title": "Projector not working",
  "category": "Classroom / Infrastructure",
  "location": "Block A, Room 204",
  "description": "The classroom projector does not turn on during lectures."
}
```

A successful response uses HTTP `201 Created` and returns the complaint including its tracking code. Requests without a valid token return `401`; insufficient role permissions return `403`; invalid fields return `400`; missing records return `404`. Server errors return a generic `500` message, while detailed errors remain in the server terminal.

## 12. Test checklist

- [ ] `/api/health` returns status `ok`.
- [ ] A new student can register and log in.
- [ ] A complaint with valid fields is saved and appears in the list.
- [ ] Blank title, invalid category, or too-short description is rejected.
- [ ] Refreshing the page and logging in again still shows saved complaints.
- [ ] A student account cannot see another student's complaints.
- [ ] A student cannot update a complaint status; the API returns `403`.
- [ ] An admin can see complaints from different users.
- [ ] An admin can change status to Submitted, In Progress, Resolved, or Rejected.
- [ ] Search and status filtering work.
- [ ] The page remains usable on a phone-sized screen.
- [ ] An expired/invalid access token is rejected.

## 13. Troubleshooting

**`Missing required environment variable`**
- Confirm `backend/.env` exists and contains all three Supabase variables.
- Ensure the file is named `.env`, not `.env.txt`.
- Restart the server after editing it.

**`Cannot reach the server`**
- Check that `npm start` is still running.
- Open `http://localhost:3000/api/health`.
- Check whether another app is using port 3000; if so, change `PORT` in `.env`.

**Database/table errors**
- Confirm `database/schema.sql` ran successfully in the correct Supabase project.
- Verify the tables are named `profiles` and `complaints`.
- Verify the environment variables point to that same project.

**Sign-up works but login says email confirmation is needed**
- Open the confirmation email and follow its link.
- For a local classroom demo, you may adjust Supabase Auth email-confirmation settings in the dashboard. Do not disable confirmations for a real public service without considering the security impact.

**User has no profile**
- Check whether the `handle_new_user` trigger exists and whether `profiles` contains a row with the user's Auth ID. Re-run the schema carefully if the trigger was not created.

**Admin controls are missing**
- Confirm the account's role in `public.profiles` is `admin`.
- Log out and log back in after changing the role.

**Node version or package errors**
- Install a current Node.js LTS release and open a fresh terminal.
- Run `npm install` inside `backend/`, not the root folder.

## 14. Security notes and limitations

- This is an educational MVP, not a production campus grievance service.
- Protect the service-role key and rotate it immediately if exposed.
- The app currently uses bearer access tokens in browser memory; reloading the page requires logging in again. This avoids storing the access token in persistent browser storage, but a production system should consider a carefully designed session strategy.
- Auth requests are rate-limited by the Express server, but production deployment also needs HTTPS, monitoring, backups, stronger operational controls, and security review.
- RLS is enabled on the tables, and no direct public table policies are created. Database access in this implementation goes through the protected backend. If you later add direct browser-to-Supabase queries, design and test RLS policies before doing so.
- Admins can update statuses, but the current MVP does not include file attachments, email notifications, complaint comments, or a status-change audit history.
- The admin list uses Supabase Auth's admin user listing to display student email addresses. For a large deployment, replace this with a paginated profile/contact design with appropriate privacy controls.

## 15. GitHub upload

Create an empty repository on https://github.com/ and copy its repository URL. Run the following from the **project root**, not from `backend`:

```bash
git init
git status
git add .
git status
git commit -m "Build campus grievance management system"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the real URL for your repository. For example, it may look like `https://github.com/your-username/campus-complaint-and-grievance-management-system.git`.

Before `git add .`, confirm:
- `backend/.env` is not listed by `git status`.
- `backend/.env.example` is included.
- `node_modules/` is ignored.
- No passwords, tokens, service-role keys, private student data, or database exports are committed.

If you accidentally commit a secret, deleting the file in a later commit is not enough. Rotate/revoke the exposed credential immediately and clean the repository history as appropriate.

If you already created an empty GitHub repository, use its URL in the `git remote add origin` command. If `origin` already exists, check it with `git remote -v` rather than adding it again.

## 16. Future improvements

- Complaint comments and status-change history.
- Email notifications when a status changes.
- Admin assignment by department.
- Anonymous reporting where legally and operationally appropriate.
- Reports by category and month.
- Accessibility review and multilingual interface.
- Production deployment with HTTPS, backups, and monitoring.
