const admin = require('firebase-admin');
const fs = require('fs');

async function debugBuckets() {
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(key)
      });
    }

    const storage = admin.storage();
    // Use the underlying GCS client to list buckets
    const [buckets] = await storage.storage.getBuckets();
    
    console.log("🔍 DISCOVERED BUCKETS:");
    buckets.forEach((b: any) => console.log(` - ${b.name}`));
    
    if (buckets.length > 0) {
      const bucket = buckets[0];
      console.log(`🚀 Attempting to set CORS on primary discovered bucket: ${bucket.name}`);
      await bucket.setMetadata({
        cors: [
          {
            origin: ["*"],
            method: ["GET", "POST", "PUT", "DELETE", "HEAD"],
            responseHeader: ["*"],
            maxAgeSeconds: 3600
          }
        ]
      });
      console.log("✨ SUCCESS! CORS set successfully.");
    } else {
      console.log("❌ No buckets found in this project.");
    }
    process.exit(0);
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

debugBuckets();
