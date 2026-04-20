import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { analysisId, videoId, childId, teacherId = "system" } = await request.json();

    if (!analysisId || !videoId || !childId) {
      return NextResponse.json({ error: "analysisId, videoId and childId are required" }, { status: 400 });
    }

    const db = getAdminDb();
    const now = new Date();

    // 1. Fetch the analysis data
    const analysisSnap = await db.collection("video_analysis").doc(analysisId).get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }
    const analysis = analysisSnap.data()!;
    const { frameAnalysis, summary, interventionPlan } = analysis;

    // 2. Fetch child data for parentId/teacherId
    const childSnap = await db.collection("children").doc(childId).get();
    const child = childSnap.data() || {};

    // 3. Save individual lessons
    await Promise.all(
      (interventionPlan.lessons ?? []).map(async (lesson: any, idx: number) => {
        const lessonId = `LS_${childId}_${Date.now()}_${idx}`;
        await db.collection("lessons").doc(lessonId).set({
          id: lessonId,
          childId,
          analysisId,
          videoId,
          ...lesson,
          lessonId,
          status: "active",
          createdAt: now,
          collaborationTaskId: null,
          source: "ai_video",
        });
      })
    );

    // 4. Create collaboration_task for parent
    let taskId: string | null = null;
    const msg = interventionPlan.collaborationMessage;
    if (msg && child.parentId) {
      taskId = `TASK_${childId}_${Date.now()}`;
      await db.collection("collaboration_tasks").doc(taskId).set({
        id: taskId,
        teacherId: child.teacherId ?? teacherId,
        parentId: child.parentId,
        childId,
        content: msg,
        topic: interventionPlan.lessons?.[0]?.title ?? "Bài học can thiệp mới",
        status: "unread",
        createdAt: now,
        analysisId,
      });
      await db.collection("video_analysis").doc(analysisId).update({ linkedTaskId: taskId });
    }

    // 5. Update video_modeling status + mark confirmedAt on analysis record
    await Promise.all([
      db.collection("video_modeling").doc(videoId).update({ status: "Đã phân tích" }),
      db.collection("video_analysis").doc(analysisId).update({ confirmedAt: now }),
    ]);

    // 6. Update hpdt_stats
    const hpdtSnap = await db.collection("hpdt_stats").where("childId", "==", childId).limit(1).get();
    const hpdtDoc = hpdtSnap.docs[0];

    const newDimensions = {
      communication: frameAnalysis.hpdt.cognitive,
      social: frameAnalysis.hpdt.social,
      behavior: frameAnalysis.hpdt.behavior,
      sensory: frameAnalysis.hpdt.sensory,
    };
    const analysisSnapshot = {
      analysisId,
      videoId,
      regulationLevel: summary.regulationLevel,
      dominantBehavior: summary.dominantBehavior,
      motor: frameAnalysis.hpdt.motor,
      analyzedAt: now,
    };
    const historyData = {
      overallScore: frameAnalysis.hpdt.overall,
      dimensions: newDimensions,
      ...analysisSnapshot,
    };

    if (hpdtDoc) {
      await hpdtDoc.ref.update({
        overallScore: frameAnalysis.hpdt.overall,
        dimensions: newDimensions,
        latestAnalysis: analysisSnapshot,
        lastUpdate: now,
      });
      await hpdtDoc.ref.collection("history").add(historyData);
    } else {
      const newHpdtRef = await db.collection("hpdt_stats").add({
        childId,
        overallScore: frameAnalysis.hpdt.overall,
        dimensions: newDimensions,
        latestAnalysis: analysisSnapshot,
        lastUpdate: now,
      });
      await newHpdtRef.collection("history").add(historyData);
    }

    return NextResponse.json({ success: true, taskId });
  } catch (err) {
    console.error("[analyze-video/confirm]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
