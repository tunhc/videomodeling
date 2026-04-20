import { NextRequest, NextResponse } from "next/server";
import {
  analyzeVideoFrames,
  generateInterventionFromAnalysis,
  generateReportContent,
  type FullVideoAnalysis,
  type VideoAnalysisResult,
  type ReportContent,
} from "@/lib/claude";
import { getAdminDb } from "@/lib/firebase-admin";
import { cloudinaryService } from "@/lib/services/cloudinaryService";

export const runtime = "nodejs";
export const maxDuration = 300;

// ── GET: fetch existing analysis for a video ───────────────────────────────
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("video_analysis")
      .where("videoId", "==", videoId)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sorted = snap.docs.sort((a, b) => {
      const ta = a.data().createdAt?.toMillis?.() ?? 0;
      const tb = b.data().createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

    const docData = sorted[0].data();
    const normalized = {
      ...docData,
      analysisId: docData.analysisId ?? docData.id ?? sorted[0].id,
    };

    return NextResponse.json(normalized);
  } catch (err) {
    console.error("[analyze-video GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST: run full analysis pipeline + save to Firestore ───────────────────
export async function POST(request: NextRequest) {
  try {
    const {
      videoId,
      childId,
      teacherId = "system",
      senderRole = "teacher",
      childState,
      locationNote,
    } = (await request.json()) as {
      videoId: string;
      childId: string;
      teacherId?: string;
      /** "parent" | "teacher" — dùng để cá nhân hóa lời khuyên */
      senderRole?: "parent" | "teacher" | "system";
      /** Trạng thái trẻ do người gửi mô tả, vd: "hưng phấn", "mệt mỏi" */
      childState?: string;
      /** Ghi chú về nơi quay, vd: "phòng học yên tĩnh, 1-1 với GV" */
      locationNote?: string;
    };

    if (!videoId || !childId) {
      return NextResponse.json(
        { error: "videoId and childId are required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    const [videoSnap, childSnap, hpdtSnap] = await Promise.all([
      db.collection("video_modeling").doc(videoId).get(),
      db.collection("children").doc(childId).get(),
      db.collection("hpdt_stats").where("childId", "==", childId).limit(1).get(),
    ]);

    if (!videoSnap.exists) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const video = videoSnap.data()!;
    const child = childSnap.data() ?? { name: childId };
    const hpdtDoc = hpdtSnap.docs[0];
    const hpdt = (hpdtDoc?.data() ?? {
      overallScore: 0,
      dimensions: { communication: 0, social: 0, behavior: 0, sensory: 0 },
    }) as { overallScore: number; dimensions?: { communication?: number; social?: number; behavior?: number; sensory?: number } };

    const rawUrl = typeof video.url === "string" ? cloudinaryService.deobfuscateUrl(video.url) : "";
    const videoUrl = rawUrl.startsWith("http") ? rawUrl : "";
    console.log("[analyze-video] videoUrl:", videoUrl);

    // Build enriched context — merges caller-supplied inputs with video metadata
    const enrichedContext = {
      childId,
      primaryTag: video.primaryTag,
      context: video.context ?? video.location,
      topic: video.topic,
      senderRole,
      childState: childState ?? (video as any).childState,
      locationNote: locationNote ?? (video as any).locationNote,
      parentNote: (video as any).parentNote,
      expertNote: (video as any).expertNote,
    };

    // ── Phase 1: Frame analysis ─────────────────────────────────────────────
    const frameAnalysis: VideoAnalysisResult = await analyzeVideoFrames(
      videoUrl,
      video.duration ?? 60,
      enrichedContext,
    );

    // ── Phase 2: Behavior segments + Intervention plan ──────────────────────
    const enrichedVideo = { ...video, senderRole, childState, locationNote };
    const fullAnalysis: FullVideoAnalysis = await generateInterventionFromAnalysis(
      frameAnalysis,
      enrichedVideo,
      child,
      childId,
      hpdt
    );

    // ── Phase 3: Clinical report content (for PDF export) ───────────────────
    const reportContent: ReportContent = await generateReportContent(
      frameAnalysis,
      fullAnalysis,
      enrichedVideo,
      child,
      childId
    );

    // ── Save to Firestore ───────────────────────────────────────────────────
    const now = new Date();
    const analysisId = `VA_${childId}_${Date.now()}`;

    await db.collection("video_analysis").doc(analysisId).set({
      id: analysisId,
      videoId,
      childId,
      createdAt: now,
      createdBy: teacherId,
      senderRole,
      childState: childState ?? null,
      locationNote: locationNote ?? null,
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
    });

    return NextResponse.json({
      analysisId,
      frameAnalysis,
      segments: fullAnalysis.segments,
      summary: fullAnalysis.summary,
      interventionPlan: fullAnalysis.interventionPlan,
    });
  } catch (err) {
    console.error("[analyze-video]", err);
    return NextResponse.json(
      {
        error: "Phân tích thất bại",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
