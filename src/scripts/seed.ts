import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// 1. Initialize Firebase Admin with Robust JSON loading
const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
let serviceAccount: any;

try {
  const rawData = fs.readFileSync(keyPath, "utf8");
  // Fix potential bad escapes in the private_key base64 string
  // (e.g., \nu should just be nu or \ followed by n then u)
  const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
  serviceAccount = JSON.parse(sanitizedData);
} catch (error) {
  console.error("❌ Failed to parse serviceAccountKey.json:", error);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * AI4Autism Database Seeder (Admin Version)
 * Initializes collections so they appear in the Firebase Console.
 */
async function seedDatabase() {
  console.log("🚀 Initializing AI4Autism Database Schema (via Admin SDK)...");

  try {
    const studentId = "minh-khoi";
    
    // 1. Students
    await db.collection("students").doc(studentId).set({
      name: "Minh Khôi",
      age: 6,
      diagnosis: "ASD Level 2",
      teacherId: "teacher-yang",
      parentId: "parent-khoi",
      avatar: "/avatars/khoi.png",
      status: "Bình thường",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("✅ Created 'students' collection.");

    // 2. hpDT Stats
    await db.collection("hpdt_stats").doc(studentId).set({
      overallScore: 68,
      dimensions: {
        communication: 65,
        social: 55,
        behavior: 72,
        sensory: 80
      },
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("✅ Created 'hpdt_stats' collection.");

    // 3. Categories 
    await db.collection("categories").doc("cat_giao_tiep").set({
      name: "Giao tiếp",
      slug: "Giao_Tiep",
      description: "Các bài tập về ngôn ngữ và tương tác mắt",
      icon: "MessageSquare"
    });
    console.log("✅ Created 'categories' collection.");

    // 4. Collaboration Tasks
    await db.collection("collaboration_tasks").doc("sample-task-1").set({
      teacherId: "teacher-yang",
      childId: studentId,
      parentId: "parent-khoi",
      content: "Mẹ hãy cùng bé thực hiện bài tập 'Chào hỏi' 3 lần vào buổi chiều nhé.",
      status: "unread",
      type: "instruction",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("✅ Created 'collaboration_tasks' collection.");

    console.log("\n🎉 Database setup complete! Check your Firebase Console now.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    process.exit();
  }
}

seedDatabase();
