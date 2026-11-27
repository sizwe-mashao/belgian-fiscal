/**
 * Forwards a contact-form message by email, through Resend's HTTP API.
 *
 * Configured entirely by environment variables, so no address or key lives in
 * the repo:
 *
 *   RESEND_API_KEY    API key from the Resend dashboard
 *   CONTACT_TO_EMAIL  where messages are delivered (the owner's inbox)
 *   CONTACT_FROM_EMAIL optional sender, e.g. "contact@openbudgets.be" once that
 *                     domain is verified in Resend. Defaults to Resend's test
 *                     sender, which can only deliver to the address the Resend
 *                     account was created with.
 *
 * Reply-To is the visitor, so hitting Reply in the inbox answers them directly.
 * With RESEND_API_KEY or CONTACT_TO_EMAIL unset, nothing is sent.
 */

export type ContactMessage = {
  name: string;
  email: string;
  topic: "general" | "data-error";
  message: string;
  lang: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "onboarding@resend.dev";

const TOPIC_LABEL: Record<ContactMessage["topic"], string> = {
  general: "General question",
  "data-error": "Data error report",
};

// Header values must stay on one line, and a display name must not be able to
// close its own quotes.
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function forwardContactMessage(msg: ContactMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) return;

  const from = process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM;
  const topic = TOPIC_LABEL[msg.topic];
  const senderName = oneLine(msg.name).replace(/["\\]/g, "");

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `openbudgets.be contact form <${from}>`,
      to: [to],
      reply_to: `"${senderName}" <${msg.email}>`,
      subject: oneLine(`[openbudgets.be] ${topic} from ${msg.name}`),
      text: [
        `Name: ${msg.name}`,
        `Email: ${msg.email}`,
        `Topic: ${topic}`,
        `Language: ${msg.lang}`,
        "",
        msg.message,
        "",
        "—",
        "Sent from the contact form on openbudgets.be. Reply to this email to answer the sender.",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    // Resend's error body names the problem (bad key, unverified sender, …)
    // and never echoes the key back.
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${detail}`);
  }
}
