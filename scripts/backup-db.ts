
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function backup() {
  console.log('📦 Starting Local Firestore Backup...');
  
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(key) });
    }

    const db = admin.firestore();
    const collections = ['children', 'students', 'hpdt_stats', 'users', 'schools', 'video_modeling', 'videos'];
    const backupData = {};

    for (const colName of collections) {
      console.log(`- Fetching ${colName}...`);
      const snap = await db.collection(colName).get();
      backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `firestore_backup_${timestamp}.json`;
    const filePath = path.join(process.cwd(), 'backups', fileName);

    if (!fs.existsSync(path.join(process.cwd(), 'backups'))) {
      fs.mkdirSync(path.join(process.cwd(), 'backups'));
    }

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
    console.log(`\n✅ Backup completed: ${filePath}`);
    console.log(`Total collections: ${Object.keys(backupData).length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

backup();
