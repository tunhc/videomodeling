const path = require('path');
const fs = require('fs');

async function test() {
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "video-modeling-c46ff.firebasestorage.app";
  
  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  const rawData = fs.readFileSync(keyPath, 'utf8');
  let sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
  const serviceAccount = JSON.parse(sanitizedData);
  
  const admin = require('firebase-admin');
  
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
    console.log("Firebase Init OK");
    
    const bucket = admin.storage().bucket();
    const fileRef = bucket.file("test-video.mp4");
    
    // Test signed URL
    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '01-01-2099'
    });
    console.log("Signed URL OK:", signedUrl.substring(0, 50));
    
  } catch (error) {
    console.error("Firebase Error:", error.message);
  }
}

test();
