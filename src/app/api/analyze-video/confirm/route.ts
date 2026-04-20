import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc,
  setDoc, updateDoc, addDoc, limit,
} from "firebase/firestore";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { analysisId, videoId, childId, teacherId = "system" } = await request.json();

    if (!analysisId || !videoId || !childId) {
      return NextResponse.json({ error: "analysisId, videoId and childId are required" }, { status: 400 });
    }

    const now = new Date();

    // 1. Fetch analysis data
    const analysisSnap = await getDoc(doc(db, "video_analysis", analysisId));
    if (!analysisSnap.exists()) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }
    const analysis = analysisSnap.data()!;
    const { frameAnalysis, summary, interventionPlan } = analysis;

    // 2. Fetch child data
    const childSnap = await getDoc(doc(db, "children", childId));
    const child = childSnap.data() || {};

    // 3. Save individual lessons
    await Promise.all(
      (interventionPlan.lessons ?? []).map(async (lesson: any, idx: number) => {
        const lessonId = `LS_${childId}_${Date.now()}_${idx}`;
        await setDoc(doc(db, "lessons", lessonId), {
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
      await setDoc(doc(db, "collaboration_tasks", taskId), {
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
      await updateDoc(doc(db, "video_analysis", analysisId), { linkedTaskId: taskId });
    }

    // 5. Update video_modeling status + mark confirmedAt
    await Promise.all([
      updateDoc(doc(db, "video_modeling", videoId), { status: "Đã phân tích" }),
      updateDoc(doc(db, "video_analysis", analysisId), { confirmedAt: now }),
    ]);

    // 6. Update hpdt_stats
    const hpdtSnap = await getDocs(
      query(collection(db, "hpdt_stats"), where("childId", "==", childId), limit(1))
    );
    const hpdtDocSnap = hpdtSnap.docs[0];

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

    if (hpdtDocSnap) {
      await updateDoc(hpdtDocSnap.ref, {
        overallScore: frameAnalysis.hpdt.overall,
        dimensions: newDimensions,
        latestAnalysis: analysisSnapshot,
        lastUpdate: now,
      });
      await addDoc(collection(db, "hpdt_stats", hpdtDocSnap.id, "history"), historyData);
    } else {
      const newHpdtRef = await addDoc(collection(db, "hpdt_stats"), {
        childId,
        overallScore: frameAnalysis.hpdt.overall,
        dimensions: newDimensions,
        latestAnalysis: analysisSnapshot,
        lastUpdate: now,
      });
      await addDoc(collection(db, "hpdt_stats", newHpdtRef.id, "history"), historyData);
    }

    return NextResponse.json({ success: true, taskId });
  } catch (err) {
    console.error("[analyze-video/confirm]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
