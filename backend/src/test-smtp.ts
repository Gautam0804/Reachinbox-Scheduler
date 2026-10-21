
import "dotenv/config";
import nodemailer from "nodemailer";
import { env } from "./config/env.js";

async function testSmtp() {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log("SMTP connection and authentication successful.");

    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: env.SMTP_USER,
      subject: "ReachInbox SMTP verification",
      text: "SMTP test successful. This message was sent through Ethereal.",
    });

    console.log("Message accepted by SMTP server.");
    console.log("Message ID:", info.messageId);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log("Preview URL:", previewUrl ?? "Not available");
  } catch (error) {
    console.error(
      "SMTP test failed:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    transporter.close();
  }
}

void testSmtp();
