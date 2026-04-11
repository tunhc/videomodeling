const admin = require('firebase-admin');
const fs = require('fs');

async function listBuckets() {
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(key)
      });
    }

    const [buckets] = await admin.storage().getBuckets();
    console.log("--- BUCKET LIST ---");
    buckets.forEach((b: any) => console.log(b.name));
    console.log("-------------------");
    process.exit(0);
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

listBuckets();
