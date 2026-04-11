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

async function listPasswords() {
  const snap = await db.collection("users").get();
  console.log("| role | username | password | displayName |");
  console.log("| :--- | :--- | :--- | :--- |");
  
  const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort by role then name
  docs.sort((a, b) => {
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    return a.id.localeCompare(b.id);
  });

  docs.forEach(u => {
    console.log(`| ${u.role} | ${u.id} | ${u.password || '-'} | ${u.displayName} |`);
  });
  
  process.exit(0);
}

listPasswords();
