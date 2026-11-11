import "server-only";
import { appendFile } from "node:fs/promises";
import nodemailer from "nodemailer";

export async function sendAccountLink(email: string, subject: string, url: string) {
  const origin = new URL(process.env.APP_ORIGIN!);
  if (process.env.AUTH_EMAIL_MODE === "local") {
    if (!["127.0.0.1", "localhost"].includes(origin.hostname)) throw new Error("Local email preview requires a loopback origin.");
    await appendFile("docs/auth-outbox.local.md", `\n## ${subject}\n\nTo ${email}\n\n[Open account link](${url})\n\nCreated at ${new Date().toISOString()}. Link expires in one hour.\n`, { mode: 0o600 });
    return;
  }
  const { SMTP_HOST: host, SMTP_PORT: port, SMTP_USER: user, SMTP_PASSWORD: pass, SMTP_FROM: from } = process.env;
  if (!host || !port || !user || !pass || !from) throw new Error("Email delivery is not configured.");
  const transport = nodemailer.createTransport({
    host, port: Number(port), secure: Number(port) === 465,
    requireTLS: Number(port) !== 465, auth: { user, pass },
    disableFileAccess: true, disableUrlAccess: true,
  });
  await transport.sendMail({ from, to: email, subject, text: `${subject}\n\n${url}\n\nThis link expires in one hour.` });
}
