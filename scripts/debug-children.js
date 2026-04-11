const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
const rawData = fs.readFileSync(keyPath, "utf8");
const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
const serviceAccount = JSON.parse(sanitizedData);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function debugChildren() {
  const snap = await db.collection("children").get();
  console.log(`Found ${snap.docs.length} children.`);
  
  snap.forEach(doc => {
    const data = doc.data();
    if (!data.name) {
      console.log(`❌ INVALID DOC: ${doc.id}`, data);
    } else {
      console.log(`✅ Valid: ${doc.id} - ${data.name}`);
    }
  });
  process.exit(0);
}

debugChildren();
