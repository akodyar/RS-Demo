import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';

let app: App | undefined;

try {
  app = getApps().length ? getApp() : initializeApp();
} catch (e) {
  console.error("Firebase Admin initialization error:", e);
}

export const firebaseAdmin = app;
export const auth = app ? getAuth(app) : undefined;
