import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// Next.js dev mode hot-reloads modules, which can call this file multiple
// times. initializeApp() throws if called twice, so guard against it.
function getAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  // Two credential paths, because the deploy target has no filesystem to put a
  // key file on:
  //
  //   Local  — GOOGLE_APPLICATION_CREDENTIALS points at the service-account
  //            JSON on disk, same as scripts/seed.js. Nothing to configure.
  //   Vercel — FIREBASE_SERVICE_ACCOUNT holds the *contents* of that JSON as a
  //            single env var, since the file itself is gitignored and never
  //            deployed.
  const inlineCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (inlineCredentials) {
    let parsed: { project_id?: string; client_email?: string; private_key?: string };
    try {
      parsed = JSON.parse(inlineCredentials);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON. Paste the whole service-account file, including the outer braces."
      );
    }

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key."
      );
    }

    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        // Some dashboards store the key with literal "\n" rather than real
        // newlines; restore them or the PEM parse fails.
        privateKey: parsed.private_key.replace(/\\n/g, "\n"),
      }),
    });
  }

  return initializeApp();
}

let _db: Firestore | null = null;

export function getDb(): Firestore {
  if (!_db) {
    const app = getAdminApp();
    _db = getFirestore(app);
  }
  return _db;
}
