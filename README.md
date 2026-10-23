ReachInbox Scheduler
A full-stack email scheduling application for composing emails, importing contacts, scheduling messages for future delivery, and tracking scheduled and sent emails through a dashboard. The project combines a React frontend with a Node.js/Express backend and background job processing.
Table of Contents
- Features
- Tech Stack
- Architecture Overview
- Project Structure
- Prerequisites
- Getting Started
- Environment Configuration
- How to Use
- API Overview
- Testing and Verification
- Troubleshooting
- Security Notes
- Future Improvements
- License
- Author
Features
Email Composition and Scheduling
- Compose emails and schedule delivery for a future date and time.
- View email records and track scheduled and sent messages from the dashboard.
- Search, filter, and paginate email records using the available dashboard controls.
- Use a dedicated compose modal with a scrollable content area and a responsive layout.
AI-Assisted Email Writing
- AI-assisted email-writing functionality is part of the project experience.
- Use the AI writing workflow to help draft email content where it is enabled in the current build.
- The exact provider, model, prompt configuration, and supported writing actions depend on the implementation and environment configuration in the repository. Configure these from the source code and environment examples rather than assuming a provider or variable name.
CSV Contact Import
- Import contact data from a CSV file through the CSV import interface.
- Use the import workflow to bring recipient/contact information into the app where supported by the current implementation.
- Check the expected CSV headers and validation rules in the current import component or backend endpoint before preparing a production CSV.
- CSV import and AI-assisted writing are separate workflows; do not assume importing a CSV automatically invokes AI processing.
Authentication, Delivery, and Integrations
- Google OAuth sign-in.
- Session-based authentication.
- Background job processing with BullMQ and Redis.
- Email delivery through Nodemailer and a configured SMTP provider.
- Ethereal Email support for testing email delivery without sending messages to real recipients.
- Slack notifications for supported email events.
- Encrypted storage for integration tokens where implemented.
Dashboard and Operations
- Responsive UI for desktop and smaller screens.
- Email search, filtering, and pagination.
- Bull Board for monitoring background jobs.
- PostgreSQL data persistence through Prisma ORM.
- Elasticsearch is included in the documented stack; its use and configuration depend on the current source and deployment setup.
Tech Stack
Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
Backend
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- Nodemailer
- Google OAuth
- Session-based authentication
- Elasticsearch
- Bull Board
Development and Integrations
- Docker Desktop and Docker Compose
- Ethereal Email for SMTP testing
- Slack API for notifications
- AI writing integration (provider/model must be confirmed from the current code and environment configuration)
Architecture Overview
React + TypeScript Frontend
          |
          | HTTP API requests
          v
     Express Backend
       /    |      \
      v     v       v
 PostgreSQL Google   Redis
  (Prisma)  OAuth     |
                     BullMQ
                       |
                       v
               Background Worker
                       |
                       v
                   Nodemailer
                       |
                       v
                  SMTP Provider

Backend / Worker
       |
       +----> Slack notifications (supported events)
       |
       +----> AI writing service (when configured)
The frontend communicates with the Express API. PostgreSQL stores application data through Prisma. Redis and BullMQ handle background scheduling, while a worker processes queued email jobs through Nodemailer. Google OAuth supports sign-in. Slack notifications and AI writing are available where their corresponding integrations are configured and enabled.
Project Structure
The exact files and folders may vary by project version. The main layout is expected to resemble:
Reachinbox-Scheduler/
├── backend/
│   ├── src/
│   ├── prisma/
│   └── package.json
├── frontend/
│   ├── src/
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
Prerequisites
Install the following before running the application:
- Node.js and npm
- Docker Desktop
- Git
- A Google Cloud project with OAuth credentials, if Google sign-in is enabled
- SMTP credentials or an Ethereal Email account for email testing
- Slack app credentials, if Slack notifications are enabled
- Credentials for the AI provider configured by the current implementation, if AI writing is enabled
You should also be comfortable running commands in a terminal.
Getting Started
1. Clone the Repository
git clone https://github.com/Gautam0804/Reachinbox-Scheduler.git
cd Reachinbox-Scheduler
2. Configure Environment Variables
Create the environment files required by the backend, frontend, worker, and supporting services. Use the exact variable names expected by the current source code and any existing environment examples.
Depending on which features are enabled, configuration may include:
- PostgreSQL connection URL
- Redis connection URL
- Google OAuth client ID and client secret
- Session secret
- SMTP host, port, username, and password
- Slack credentials
- Encryption key for stored integration tokens
- AI provider API key/model configuration, if required by the implemented AI integration
- Frontend origin and backend port
- Elasticsearch configuration, if enabled
Important: This README does not define exact environment variable names because they must match the current application configuration. Check the backend configuration files and existing environment examples before creating local environment files.
Never commit .env files, passwords, API keys, OAuth secrets, session secrets, or access tokens to Git.
3. Start Supporting Services
From the project root, start the services defined by Docker Compose:
docker compose up -d
Check their status:
docker compose ps
Ensure PostgreSQL and Redis are running and accessible before starting the backend and worker. Other services may be defined by the current docker-compose.yml.
4. Install and Start the Backend
From the repository root:
cd backend
npm install
If the project has Prisma migrations, apply the existing migrations to the configured database:
npx prisma migrate deploy
For local development, use the project's established Prisma workflow if migrations need to be created or the schema is not yet initialized. Do not run a production migration workflow against an unintended database.
Start the backend using the script defined in backend/package.json:
npm run dev
Keep this terminal running. The exact available scripts depend on the current package configuration.
5. Start the Background Worker
Open a separate terminal at the repository root:
cd backend
npm run worker
The worker processes scheduled email jobs. Keep it running while testing scheduled delivery. If the repository uses a different worker script, use the script listed in backend/package.json.
6. Install and Start the Frontend
Open another terminal:
cd frontend
npm install
npm run dev
Open the local URL printed by Vite in the terminal. Ensure the frontend's API/origin configuration matches the backend configuration.
How to Use
1. Start the supporting services, backend, and worker.
2. Start the frontend and open the local development URL.
3. Sign in with Google if OAuth is configured and enabled.
4. Use the dashboard to browse, search, and filter email records.
5. Open the compose interface to write an email and choose a scheduled delivery time.
6. Use the AI writing feature if it is enabled and configured in the current build.
7. Use the CSV import interface to import contact data. Follow the import UI's required format and validation messages.
8. Monitor queued jobs through Bull Board if the route and access controls are enabled.
9. For development testing, use Ethereal Email or another non-production SMTP setup before sending to real recipients.
The exact flow and available controls may vary as the application evolves.
API Overview
The following routes were documented for the project. Verify the current backend route definitions before relying on them, as paths and payloads can change during development.
Method	Endpoint	Purpose
GET	/api/auth/me	Retrieve the current authenticated session/user
GET	/api/auth/google	Start Google OAuth sign-in
POST	/api/auth/logout	End the current session
GET	/api/emails	Retrieve email records
POST	/api/emails/schedule	Schedule an email for future delivery


CSV import and AI-writing endpoints are intentionally not listed here because their exact routes and request schemas have not been verified in this README. Refer to the current backend route/controller files for the authoritative API contract.
Testing and Verification
Before treating a feature as production-ready, verify it in the current local environment:
- Authentication: sign in and sign out with the configured OAuth credentials.
- Scheduling: schedule a test email and confirm it is processed at the expected time.
- Worker: verify Redis/BullMQ jobs are picked up and failures are visible in logs or Bull Board.
- Email delivery: test with Ethereal Email or a safe SMTP test account before using real recipients.
- CSV import: test a small CSV first; check required headers, invalid rows, duplicate handling, and error messages.
- AI writing: verify provider configuration, error handling, and generated content before using it in a real email.
- Responsive UI: check dashboard and compose/import dialogs at desktop and mobile viewport sizes.
- Integrations: test Slack notifications and any configured search/indexing services independently.
No automated test command is specified here because the scripts available in the current package.json files should be treated as the source of truth.
Troubleshooting
Backend cannot connect to PostgreSQL
- Confirm the database container/service is running.
- Check the database URL and credentials in the backend environment.
- Apply the migrations required by the current Prisma schema.
Jobs are not being processed
- Confirm Redis is running and reachable.
- Ensure the worker process is running in a separate terminal.
- Review backend and worker logs for connection or job errors.
Emails are not delivered
- Verify SMTP host, port, username, password, and provider settings.
- Check the job status and worker logs.
- Test with Ethereal Email before trying production SMTP credentials.
Google OAuth fails
- Confirm the OAuth client credentials are correct.
- Check the configured callback URL in Google Cloud Console.
- Ensure the frontend/backend origins and session settings match the local setup.
AI writing does not work
- Confirm the AI integration is enabled in the current code.
- Check the provider/model settings and API key expected by the implementation.
- Review backend logs and provider responses; never expose API keys in client-side code or logs.
CSV import fails
- Confirm the file is a valid CSV and uses the expected column headers.
- Check required fields, encoding, blank rows, and validation messages.
- Use a small test file to isolate formatting issues.
Frontend cannot reach the backend
- Confirm the backend is running.
- Check the frontend API base URL and backend CORS/origin configuration.
- Inspect the browser console and backend logs for request errors.
Security Notes
- Keep secrets in environment variables and out of source control.
- Do not commit .env files or real credentials.
- Keep AI provider keys on the server side; do not expose them in frontend bundles.
- Use HTTPS, secure cookie settings, appropriate session configuration, and restrictive CORS settings in production.
- Validate and sanitize email content, imported CSV data, and API inputs on the server.
- Restrict access to operational tools such as Bull Board.
- Use test SMTP credentials during development.
- Review token encryption, authorization checks, rate limiting, and error handling before production deployment.
Future Improvements
Possible follow-up work, depending on current implementation status:
- Add automated tests for scheduling, CSV validation, and AI-writing flows.
- Document exact environment variable names and all API routes from source.
- Add stronger import reporting for invalid rows and duplicate contacts.
- Add observability and production deployment instructions.
- Add more robust retry handling and delivery-status reporting.
- Expand AI-writing controls and safeguards if required by the product.
License
No license has been specified in the project information available for this README. Add a LICENSE file before distributing the project under an open-source license.
Author
Gautam Kumar Yadav
- GitHub: @Gautam0804
- Repository: Reachinbox-Scheduler
