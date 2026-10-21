export interface ScheduledEmailJob {
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
}