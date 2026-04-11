import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

if (!admin.apps.length) {
  try {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    const rawData = fs.readFileSync(keyPath, 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
    const serviceAccount = JSON.parse(sanitizedData);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
  } catch (error) {
    console.log('Firebase admin initialization error', error);
  }
}

const adminDb = admin.firestore();
const adminStorage = admin.storage();

export { adminDb, adminStorage };
