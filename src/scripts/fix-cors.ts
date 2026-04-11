const admin = require('firebase-admin');
const fs = require('fs');

async function setCors() {
  console.log('⚡ Attempting to set CORS configuration programmatically...');
  
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    const bucketNames = [
      "video-modeling-c46ff.firebasestorage.app",
      "video-modeling-c46ff.appspot.com"
    ];

    let success = false;

    for (const bucketName of bucketNames) {
      console.log(`📦 Trying bucket: ${bucketName}...`);
      try {
        if (admin.apps.length > 0) {
          await admin.app().delete();
        }
        
        admin.initializeApp({
          credential: admin.credential.cert(key),
          storageBucket: bucketName
        });

        const bucket = admin.storage().bucket();
        await bucket.setMetadata({
          cors: [
            {
              origin: ["*"],
              method: ["GET", "POST", "PUT", "DELETE", "HEAD"],
              responseHeader: ["Content-Type", "x-goog-resumable"],
              maxAgeSeconds: 3600
            }
          ]
        });
        console.log(`✅ SUCCESS: CORS configuration updated for ${bucketName}!`);
        success = true;
        break;
      } catch (err: any) {
        console.log(`❌ Failed for ${bucketName}: ${err.message}`);
      }
    }

    if (success) {
      console.log("🎉 All set! You can now upload videos from localhost:3000.");
      process.exit(0);
    } else {
      console.error("⛔ ALL ATTEMPTS FAILED. Please check your Firebase Console for the correct bucket name.");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ CRITICAL ERROR:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

setCors();
