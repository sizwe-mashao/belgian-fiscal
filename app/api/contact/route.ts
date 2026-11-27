import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { forwardContactMessage } from "@/lib/contactMail";
import { getDb } from "@/lib/firebaseAdmin";

/**
 * POST /api/contact
 * Body: { name, email, topic, message, lang, website }
 *
 * Stores the message in the Firestore `contact_messages` collection, read in
 * the Firebase console. `website` is a honeypot: humans never see the field,
 * so a filled value means a bot — answer as if it worked and store nothing.
 *
 * Only what the visitor typed is stored (plus language and a timestamp); no IP
 * address or user agent. Each saved message is then emailed to the owner via
 * Resend (lib/contactMail.ts) when RESEND_API_KEY and CONTACT_TO_EMAIL are set.
 */

const TOPICS = ["general", "data-error"] as const;
const LANGS = ["EN", "FR", "NL", "DE"] as const;

const LIMITS = { name: 100, email: 200, messageMin: 10, messageMax: 5000 };

// Deliberately loose: the point is to catch typos, not to police addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (str(body.website)) {
    return NextResponse.json({ ok: true });
  }

  const name = str(body.name);
  const email = str(body.email);
  const message = str(body.message);
  const topic = TOPICS.find((t) => t === body.topic) ?? "general";
  const lang = LANGS.find((l) => l === body.lang) ?? "EN";

  if (!name || name.length > LIMITS.name) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (message.length < LIMITS.messageMin || message.length > LIMITS.messageMax) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  try {
    await getDb().collection("contact_messages").add({
      name,
      email,
      topic,
      message,
      lang,
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Error saving contact message:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Firestore is the record; the email is a convenience. If sending fails the
  // message is still saved, so the visitor is told it was sent.
  try {
    await forwardContactMessage({ name, email, topic, message, lang });
  } catch (err) {
    console.error("Contact message saved, but forwarding by email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
