import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

type ServiceAccountLike = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

let initAttempted = false;

function readServiceAccountFromEnv(): ServiceAccountLike | null {
  const raw =
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    '';

  if (!raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as ServiceAccountLike;
    if (!parsed.private_key || !parsed.client_email || !parsed.project_id) return null;
    return {
      ...parsed,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch {
    return null;
  }
}

function readServiceAccountFromSplitEnv(): ServiceAccountLike | null {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    '';

  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    '';

  const privateKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    '';

  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, '\n'),
  };
}

function readServiceAccountFromFile(): ServiceAccountLike | null {
  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) return null;

  try {
    const rawData = fs.readFileSync(keyPath, 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const parsed = JSON.parse(sanitizedData) as ServiceAccountLike;
    if (!parsed.private_key || !parsed.client_email || !parsed.project_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function ensureAdminApp() {
  if (admin.apps.length > 0) return admin.app();
  if (initAttempted) return null;

  initAttempted = true;

  const serviceAccount =
    readServiceAccountFromEnv() ||
    readServiceAccountFromSplitEnv() ||
    readServiceAccountFromFile();
  if (!serviceAccount) {
    console.warn('Firebase admin credential not found.');
    return null;
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } catch (error) {
    console.log('Firebase admin initialization error', error);
    return null;
  }
}

export function getAdminDb() {
  const app = ensureAdminApp();
  if (!app) {
    throw new Error('Firebase Admin chưa được cấu hình. Thiếu service account credential.');
  }
  return admin.firestore(app);
}

export function getAdminStorage() {
  const app = ensureAdminApp();
  if (!app) {
    throw new Error('Firebase Admin chưa được cấu hình. Thiếu service account credential.');
  }
  return admin.storage(app);
}
