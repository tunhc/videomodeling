const admin = require('firebase-admin');
const fs = require('fs');

async function standardize() {
  console.log('🏗️  Starting Data Engineer Database Standardization...');
  
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(key) });
    }

    const db = admin.firestore();

    const collections = ['children', 'students'];

    for (const colName of collections) {
      console.log(`\nStandardizing collection: ${colName}...`);
      const snap = await db.collection(colName).get();
      const batch = db.batch();
      let count = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        const updates: any = {};

        // 1. Rename birthDay to birthday
        if (data.birthDay !== undefined) {
          updates.birthday = data.birthDay;
          updates.birthDay = admin.firestore.FieldValue.delete();
        }

        // 2. Standardize birthday to Timestamp
        const bday = updates.birthday || data.birthday;
        if (bday && typeof bday === 'string') {
          const timestamp = parseDate(bday);
          if (timestamp) {
            updates.birthday = timestamp;
          }
        }

        // 3. Ensure numeric IDs are consistent (though doc IDs are usually strings)
        // We will just leave doc IDs as they are but ensure data inside is clean.

        if (Object.keys(updates).length > 0) {
          batch.update(doc.ref, updates);
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        console.log(`✅ Standardized ${count} documents in ${colName}.`);
      } else {
        console.log(`✨ Collection ${colName} is already standardized.`);
      }
    }

    console.log('\n🎉 DATABASE STANDARDIZATION COMPLETED!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Standardization failed:', error);
    process.exit(1);
  }
}

function parseDate(dateStr: string) {
  try {
    let d;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      // Handle D/M/YYYY
      d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    } else {
      // Handle YYYY-MM-DD
      d = new Date(dateStr);
    }
    
    if (!isNaN(d.getTime())) {
      return admin.firestore.Timestamp.fromDate(d);
    }
  } catch (e) {
    return null;
  }
  return null;
}

standardize();
