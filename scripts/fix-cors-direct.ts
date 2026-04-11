const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

async function fixCors() {
  console.log('🌐 Using @google-cloud/storage directly...');
  
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    const storage = new Storage({
      projectId: key.project_id,
      credentials: key
    });

    const [buckets] = await storage.getBuckets();
    
    if (buckets.length === 0) {
       console.log("❌ No buckets found. Please create a bucket in the Firebase Console first!");
       process.exit(1);
    }

    for (const bucket of buckets) {
      console.log(`🚀 Setting CORS on: ${bucket.name}`);
      await bucket.setMetadata({
        cors: [{
          origin: ['*'],
          method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
          responseHeader: ['*'],
          maxAgeSeconds: 3600
        }]
      });
      console.log(`✅ SUCCESS for ${bucket.name}`);
    }
    process.exit(0);
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

fixCors();
