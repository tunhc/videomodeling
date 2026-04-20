import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
let serviceAccount: any;
try {
  const rawData = fs.readFileSync(keyPath, "utf8");
  const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
  serviceAccount = JSON.parse(sanitizedData);
} catch (error) {
  console.error("❌ Failed to parse serviceAccountKey.json:", error);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// Mock dependencies or import from source
// Note: We need to use 'tsx' or 'ts-node' to run this
import { analyzeVideoWithGeminiFiles, analyzeVideoFrames, generateReportContent, clampHpdt } from "../src/lib/claude";

async function deobfuscateUrl(obfuscatedUrl: string): Promise<string> {
  try {
    return Buffer.from(obfuscatedUrl, "base64").toString("utf-8");
  } catch (e) {
    return obfuscatedUrl;
  }
}

async function runBatch() {
  console.log("🚀 Starting Batch Video Analysis...");

  try {
    // 1. Get all pending videos, then sort in-memory to avoid indexing issues
    const videoSnap = await db.collection("video_modeling")
      .where("status", "==", "pending")
      .get();
    
    const docs = videoSnap.docs.sort((a, b) => {
      const ta = a.data().createdAt?.seconds || 0;
      const tb = b.data().createdAt?.seconds || 0;
      return ta - tb;
    });

    console.log(`\nFound ${docs.length} pending videos.`);

    if (videoSnap.empty) {
      console.log("✅ No pending videos to process.");
      return;
    }

    for (const doc of docs) {
      const video = doc.data();
      const videoId = doc.id;
      const childId = video.childId;

      console.log(`\n--- Processing Video: ${videoId} (Child: ${childId}) ---`);

      // 2. Get Child Info
      const childDoc = await db.collection("children").doc(childId).get();
      const child = childDoc.exists ? childDoc.data() : { name: childId };

      // 3. Get HPDT stats
      const statsDoc = await db.collection("hpdt_stats").doc(childId).get();
      const stats = statsDoc.exists ? statsDoc.data() : { overallScore: 50 };

      // 4. Prepare Context
      const rawUrl = await deobfuscateUrl(video.url);
      const videoUrl = rawUrl.startsWith("http") ? rawUrl : "";

      if (!videoUrl) {
        console.warn(`⚠️ Skipped: Invalid video URL for ${videoId}`);
        continue;
      }

      const context = {
        childId,
        senderRole: video.role || "teacher",
        childState: video.childState || "bình thường",
        locationNote: video.location || video.context || "không r\u00f5",
        topic: video.topic,
        parentNote: video.parentNote,
        expertNote: video.expertNote
      };

      console.log(`[AI] Analyzing video... (Context: ${context.senderRole}, ${context.childState})`);

      try {
        let frameAnalysis;
        try {
          // Attempt Gemini Files API first
          frameAnalysis = await analyzeVideoWithGeminiFiles(videoUrl, video.duration || 60, context);
          console.log("✅ Gemini Files Analysis Succeeded.");
        } catch (err) {
          console.warn("⚠️ Gemini Files failed, falling back to frames...");
          // Fallback to frame extraction
          const frameCount = 6;
          const duration = video.duration || 60;
          const frameSeconds = Array.from({ length: frameCount }, (_, i) => Math.floor((i * duration) / (frameCount - 1)));
          frameAnalysis = await analyzeVideoFrames(videoUrl, duration, frameSeconds, context);
        }

        // 5. Phase 2: Intervention Plan (Simulated or called)
        // For simplicity in script, we'll assume analyzeVideoWithGeminiFiles/analyzeVideoFrames handled FullVideoAnalysis
        // Wait, analyzeVideoFrames returns VideoAnalysisResult, not FullVideoAnalysis.
        // We need Phase 2 logic here.
        
        // Let's call Phase 2 directly if possible
        const { generateInterventionFromAnalysis } = require("../src/lib/claude");
        const fullAnalysis = await generateInterventionFromAnalysis(frameAnalysis, video, child, childId, stats);
        console.log("✅ Intervention Plan Generated.");

        // 6. Phase 3: Report
        const reportContent = await generateReportContent(frameAnalysis, fullAnalysis, video, child, childId);
        console.log("✅ Clinical Report Generated.");

        // 7. Save to Firestore
        const now = new Date();
        const analysisId = `VA_${childId}_${Date.now()}`;

        await db.collection("video_analysis").doc(analysisId).set({
          id: analysisId,
          videoId,
          childId,
          createdAt: now,
          createdBy: "agent_batch_process",
          senderRole: context.senderRole,
          childState: context.childState,
          locationNote: context.locationNote,
          frameAnalysis,
          segments: fullAnalysis.segments,
          summary: fullAnalysis.summary,
          interventionPlan: {
            planId: analysisId,
            generatedAt: now,
            ...fullAnalysis.interventionPlan,
          },
          reportContent,
          linkedTaskId: null,
          isBatchProcessed: true
        });

        // 8. Update Video Status
        await db.collection("video_modeling").doc(videoId).update({
          status: "\u0110\u00e3 ph\u00e2n t\u00edch",
          analysisId: analysisId,
          updatedAt: now
        });

        console.log(`✨ Successfully processed and saved: ${videoId}`);

        // 9. Tiny delay for stability (Paid Tier allows high RPM)
        await new Promise(r => setTimeout(r, 1000));

      } catch (aiErr: any) {
        console.error(`❌ AI Error for ${videoId}:`, aiErr.message);
      }
    }

  } catch (error) {
    console.error("❌ Batch Process Failed:", error);
  } finally {
    console.log("\n🏁 Batch Process Finished.");
    process.exit();
  }
}

runBatch();
