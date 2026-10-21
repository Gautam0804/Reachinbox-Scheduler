# ReachInbox Scheduler

A full-stack email scheduling application that allows users to compose emails, schedule delivery for a future date and time, and track scheduled and sent emails through a modern dashboard.

## Features

- **Email Scheduling:** Compose emails and schedule delivery for a future date and time.
- **Email Dashboard:** View email history and monitor scheduled and sent emails.
- **Google Authentication:** Sign in using Google OAuth.
- **Background Processing:** Process scheduled email jobs using BullMQ and Redis.
- **Email Delivery Testing:** Use Ethereal Email to test SMTP delivery without sending emails to real recipients.
- **Slack Notifications:** Send Slack notifications for supported email events.
- **Responsive UI:** Modern light-themed dashboard with a responsive layout.
- **Email Search and Filtering:** Navigate email records using dashboard tabs, search, and pagination.
- **Job Monitoring:** Monitor background jobs using Bull Board.
- **Database Integration:** Store application data using PostgreSQL and Prisma ORM.
- **Session-Based Authentication:** Manage authenticated user sessions securely.
- **Integration Security:** Encrypt stored integration tokens.

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

### Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- Nodemailer
- Google OAuth
- Session-Based Authentication
- Elasticsearch
- Bull Board

### Development and Infrastructure

- Docker Desktop
- Docker Compose
- Ethereal Email for SMTP testing
- Slack API for notifications

## Architecture Overview

```text
                 React + TypeScript
                    Frontend
                       |
                       | HTTP API Requests
                       v
                  Express Backend
                  /      |       \
                 /       |        \
                v        v         v
          PostgreSQL   Google    Redis
           (Prisma)    OAuth       |
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
                          v
                   Slack Notifications
```

## Project Structure

```text
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
```

*Note: The exact files and folders may vary depending on the current project structure.*

## Prerequisites

Install the following before running the application:

- [Node.js and npm](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)
- A Google Cloud project with OAuth credentials for Google sign-in
- SMTP credentials or an Ethereal Email account for email testing
- Slack app credentials if Slack notifications are enabled

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Gautam0804/Reachinbox-Scheduler.git
cd Reachinbox-Scheduler
```

### 2. Configure Environment Variables

Create the required environment files based on the configuration expected by your backend, frontend, and supporting services.

Depending on the enabled features, configuration may include:

- Database connection URL
- Redis connection URL
- Google OAuth client ID and client secret
- Session secret
- SMTP host, port, username, and password
- Slack OAuth credentials
- Encryption key for stored integration tokens
- Frontend origin and backend port
- Elasticsearch configuration, if enabled

**Important:** Use the exact environment variable names expected by the application. Refer to the backend configuration and existing environment examples when available.

Never commit `.env` files, passwords, API keys, OAuth secrets, session secrets, or access tokens to GitHub.

### 3. Start Supporting Services

From the project root, run:

```bash
docker compose up -d
```

Make sure the required services, especially PostgreSQL and Redis, are running before starting the backend and worker.

Check their status with:

```bash
docker compose ps
```

### 4. Set Up and Start the Backend

Open a terminal in the project root:

```bash
cd backend
npm install
```

Run the database migration or Prisma setup command configured by the project. For example, if Prisma migrations are already defined:

```bash
npx prisma migrate deploy
```

For a local development database where migrations need to be created, follow the project's existing Prisma workflow instead.

Start the backend:

```bash
npm run dev
```

Keep this terminal running.

### 5. Start the Background Worker

Open a **separate terminal** in the project root:

```bash
cd backend
npm run worker
```

The background worker processes scheduled email jobs. Keep it running while testing scheduled email delivery.

Ensure the backend and worker use compatible environment configurations and can connect to Redis and PostgreSQL.

### 6. Install and Start the Frontend

Open another terminal in the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. It is commonly:

```text
http://localhost:5173
```

The frontend development server proxies API requests to the backend according to the Vite configuration.

**Note:** The commands above assume the corresponding npm scripts are configured in each package.

## How to Use

1. Start the required Docker services, backend, and background worker.
2. Open the application in your browser.
3. Sign in using Google if authentication is required.
4. Select **Compose Email**.
5. Enter the recipient's email address, subject, and message.
6. Select a future delivery date and time.
7. Schedule the email.
8. Open the Scheduled tab to verify that the email appears in the dashboard.
9. Keep the background worker running until the scheduled job is processed.
10. Check the Sent tab and email history to verify the resulting status.

For development testing, Ethereal Email can provide a preview of test messages. Ethereal is intended for testing and does not deliver messages to real recipients.

## API Overview

The frontend uses the following API routes:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/auth/me` | Retrieve the currently authenticated user |
| GET | `/api/auth/google` | Start Google OAuth authentication |
| POST | `/api/auth/logout` | Log out the current user |
| GET | `/api/emails` | Retrieve email records |
| POST | `/api/emails/schedule` | Schedule an email |

Refer to the backend route definitions for request schemas, response formats, validation rules, and additional endpoints.

## Testing

Run the scripts configured in the relevant `package.json` files.

For example, if these scripts exist:

### Type Checking

```bash
cd backend
npx tsc --noEmit
```

For frontend type checking:

```bash
cd frontend
npm run typecheck
```

### Automated Tests

If a test script is configured:

```bash
npm test
```

### Manual End-to-End Verification

Verify the following workflows:

- Google sign-in and sign-out
- Email composition and scheduling validation
- Scheduled email appearing in the dashboard
- Scheduled-to-sent status updates
- Email history, search, tabs, and pagination
- Background job processing
- Slack notifications when configured
- Responsive dashboard and Compose Email modal

## Security Notes

- Never commit secrets, `.env` files, passwords, access tokens, or credentials.
- Use a strong session secret and encryption key.
- Configure OAuth redirect URLs for your own environment.
- Restrict access to background-job monitoring interfaces.
- Disable development-only rate-limit bypasses and test settings in production.
- Use production-grade SMTP credentials and secure deployment settings before real-world use.
- Validate user input and enforce authentication and authorization on protected API routes.
- Use HTTPS and appropriate cookie security settings in production.

## Troubleshooting

### Backend Cannot Connect to PostgreSQL

- Check that the database container is running.
- Verify the database connection URL.
- Confirm that the database is accessible from the backend.

### Scheduled Emails Are Not Sent

- Make sure Redis is running.
- Confirm that the backend and background worker are running.
- Check the worker logs for job-processing errors.
- Verify that the scheduled delivery time has arrived.
- Confirm that the SMTP or Ethereal Email configuration is correct.

### Google Sign-In Fails

- Verify the Google OAuth client ID and secret.
- Check the authorized redirect URI in Google Cloud Console.
- Confirm that the backend callback URL and session configuration match your environment.

### Slack Notifications Fail

- Verify the Slack integration credentials.
- Confirm that the bot has been added to the target Slack channel.
- Check the backend or worker logs for Slack API errors.

## Future Improvements

- Deploy the application and provide a live demo.
- Add screenshots and a short demonstration video.
- Improve delivery logs, retry visibility, and error reporting.
- Add more comprehensive automated tests.
- Document production deployment and operational limits.
- Improve monitoring and observability for scheduled jobs.

## License

No license has been specified yet. Add a `LICENSE` file before distributing the project under an open-source license.

## Author

**Gautam Kumar Yadav**

GitHub: [@Gautam0804](https://github.com/Gautam0804)

Project Repository: [ReachInbox Scheduler](https://github.com/Gautam0804/Reachinbox-Scheduler)
