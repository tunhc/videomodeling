const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
const rawData = fs.readFileSync(keyPath, 'utf8');
const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
const serviceAccount = JSON.parse(sanitizedData);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const users = [
  { id: 'admin_tech', role: 'admin', password: 'admin$$$', email: 'rachelnguyen.workaholic@gmail.com' },
  { id: 'pm_Nhi', password: 'Nh!Nbai26', displayName: 'chị Nhi', email: 'kdtuonglai@gmail.com', role: 'projectmanager' },
  { id: 'ipm_AN', password: 'aAnNb@i26', email: 'luutuan_jvf@yahoo.com', displayName: 'anh An', role: 'projectmanager' },
  { id: 'CG_KBC_Binh', password: 'PT9UpN3e', email: 'kimbinh.psy@gmail.com', displayName: 'chị Kim Bình', role: 'professor' },
  { id: 'CG_NBAI_Linh', displayName: 'Mỹ Linh', email: 'linh34604@gmail.com', password: 'L!nhnb@I', role: 'professor' }
];

(async () => {
  for (const u of users) {
    const { id, ...data } = u;
    await db.collection('users').doc(id).set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log('Created user ' + id);
  }
  process.exit();
})();
