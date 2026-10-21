# ReachInbox Scheduler

A full-stack email scheduling application that lets users compose emails, schedule delivery for a future date and time, and track scheduled and sent emails from a dashboard.

## Features

- **Email Scheduling:** Compose emails and schedule them for future delivery.
- **Email Dashboard:** View email history and monitor scheduled and sent emails.
- **Google Authentication:** Sign in using Google OAuth.
- **Background Processing:** Process scheduled email jobs using BullMQ and Redis.
- **Email Delivery Testing:** Use Ethereal Email for testing SMTP delivery without sending real emails.
- **Slack Notifications:** Send Slack notifications for supported email events.
- **Responsive UI:** Modern light dashboard with a responsive layout.
- **Email Search and Filtering:** Navigate email records using the dashboard's available tabs, search, and pagination.
- **Job Monitoring:** Bull Board is included for inspecting background jobs.
- **Database Integration:** Store application data using PostgreSQL and Prisma ORM.

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- Nodemailer
- Google OAuth and session-based authentication
- Elasticsearch
- Bull Board

## Architecture Overview

```text
React + TypeScript Frontend
           |
           | HTTP API requests
           v
    Express Backend
      |     |      |
      |     |      +---- Google OAuth / Session
      |     |
      |     +----------- PostgreSQL (Prisma)
      |
      +----------------- Redis + BullMQ
                              |
                              v
                        Background Worker
                              |
                              v
                        Nodemailer / SMTP
                              |
                              v
                     Email Delivery Provider

Backend / Worker ---> Slack Notifications
```

## Project Structure

```text
reachinbox-scheduler/
├── backend/
│   ├── src/
│   ├── prisma/
│   └── package.json
├── frontend/
│   ├── src/
│   └── package.json
└── docker-compose.yml
```

*Note: The exact files and folders may vary depending on the current project structure.*

## Prerequisites

Install the following before running the application:

- Node.js and npm
- Docker Desktop
- Git (optional, for version control)
- Google OAuth credentials for Google sign-in
- SMTP credentials or Ethereal Email for email testing
- Slack app credentials if Slack notifications are enabled

## Getting Started

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd reachinbox-scheduler
```

Replace the repository URL with your actual GitHub repository URL.

### 2. Configure environment variables

Create the required environment files based on the existing backend and frontend configuration.

Typical configuration may include:

- Database connection URL
- Redis connection URL
- Google OAuth client ID and secret
- Session secret
- SMTP host, port, username, and password
- Slack OAuth credentials
- Encryption key for stored integration tokens
- Frontend origin and backend port
- Elasticsearch configuration, if enabled

Use the variable names defined in your project. Do not commit `.env` files, passwords, API keys, OAuth secrets, or tokens.

### 3. Start supporting services

From the project root, start the configured Docker services:

```bash
docker compose up -d
```

Make sure PostgreSQL and Redis are running before starting the backend and worker.

### 4. Start the backend

Open a terminal:

```bash
cd backend
npm install
```

Run the database migrations or Prisma setup command configured by the project, then start the backend:

```bash
npm run dev
```

### 5. Start the background worker

Open a **separate terminal**:

```bash
cd backend
npm run worker
```

The worker processes scheduled email jobs. Keep it running while testing scheduled delivery.

### 6. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, commonly:

```text
http://localhost:5173
```

The frontend development server proxies API requests to the backend according to the Vite configuration.

## How to Use

1. Open the dashboard.
2. Sign in using Google if authentication is required.
3. Select **Compose email**.
4. Enter the recipient, subject, and message.
5. Choose a future delivery date and time.
6. Schedule the email.
7. Check the Scheduled tab to confirm that it appears in the dashboard.
8. Keep the worker running until the scheduled job is processed.
9. Check the Sent tab and email history to verify the result.

For development testing, Ethereal Email can provide a preview of test messages. It does not deliver messages to real recipients.

## API Overview

The frontend uses the following existing API routes:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/auth/me` | Retrieve the current authenticated user |
| GET | `/api/auth/google` | Start Google authentication |
| POST | `/api/auth/logout` | Log out the current user |
| GET | `/api/emails` | Retrieve email records |
| POST | `/api/emails/schedule` | Schedule an email |

Check the backend route definitions for request schemas, response formats, and any additional endpoints.

## Testing

Run the scripts configured in each package's `package.json`.

For example, if the corresponding scripts exist:

```bash
# Frontend type checking
cd frontend
npm run typecheck

# Frontend tests
npm test
```

Verify the complete workflow:

- Google sign-in and sign-out
- Email scheduling and validation
- Scheduled-to-sent status updates
- Dashboard search, tabs, and pagination
- Slack notifications, when configured
- Responsive dashboard and Compose Email modal

## Security Notes

- Never commit secrets, `.env` files, access tokens, or credentials.
- Use a strong session secret and encryption key.
- Configure OAuth redirect URLs for your own environment.
- Disable development/test-only rate-limit bypasses in production.
- Use production-grade SMTP credentials and secure deployment settings before real-world use.

## Future Improvements

- Add deployment instructions and a live demo.
- Add more detailed delivery logs and retry visibility.
- Improve monitoring and error reporting.
- Add screenshots and a short demo video.
- Document production configuration and operational limits.

## License

Choose and add a license before distributing this project publicly.
