const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

async function fix() {
  console.log('🚀 Starting Final CORS Fix (Pure JS)...');
  
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    const storage = new Storage({
      projectId: key.project_id,
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key
      }
    });

    const [buckets] = await storage.getBuckets();
    
    if (buckets.length === 0) {
      console.log('❌ No buckets found.');
      process.exit(1);
    }

    for (const bucket of buckets) {
      console.log(`📦 Configuring bucket: ${bucket.name}`);
      await bucket.setMetadata({
        cors: [
          {
            origin: ['*'],
            method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
            responseHeader: ['*'],
            maxAgeSeconds: 3600
          }
        ]
      });
      console.log(`✅ SUCCESS for ${bucket.name}`);
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

fix();
