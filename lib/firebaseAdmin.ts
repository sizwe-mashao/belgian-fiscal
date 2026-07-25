import { initializeApp, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// Next.js dev mode hot-reloads modules, which can call this file multiple
// times. initializeApp() throws if called twice, so guard against it.
function getAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }
  // Uses GOOGLE_APPLICATION_CREDENTIALS env var, same as scripts/seed.js —
  // no separate credential setup needed here.
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