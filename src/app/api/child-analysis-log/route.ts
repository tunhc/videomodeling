import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * GET /api/child-analysis-log?childId=xxx
 *
 * Returns all saved analyses for a child, each enriched with the original
 * video's createdAt date so the frontend can build a chronological timeline.
 *
 * Shape of each log entry:
 * {
 *   analysisId, videoId, childId,
 *   videoUploadedAt,   ← date of the source video (ISO string)
 *   confirmedAt,       ← date teacher pressed "Lưu" (ISO string)
 *   hpdt: { overall, social, cognitive, behavior, sensory, motor },
 *   regulationLevel, dominantBehavior,
 *   summary, keyInsights,
 *   interventionPlan: { approach, goals, collaborationMessage },
 *   lessonCount,
 * }
 */
export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ error: "childId required" }, { status: 400 });
  }

  try {
    const db = getAdminDb();

    // Fetch all analyses for this child
    const snap = await db
      .collection("video_analysis")
      .where("childId", "==", childId)
      .get();

    if (snap.empty) {
      return NextResponse.json({ logs: [], hpdtTrend: [] });
    }

    // Batch-fetch corresponding video docs so we can get videoUploadedAt
    const videoIds = [...new Set(snap.docs.map((d) => d.data().videoId).filter(Boolean))];
    const videoMap: Record<string, any> = {};
    await Promise.all(
      videoIds.map(async (vid) => {
        const vSnap = await db.collection("video_modeling").doc(vid).get();
        if (vSnap.exists) videoMap[vid] = vSnap.data();
      })
    );

    const logs = snap.docs.map((d) => {
      const a = d.data();
      const videoDoc = videoMap[a.videoId] ?? {};

      // Determine the canonical sort date: video upload date > analysis creation date
      const videoUploadedAt =
        videoDoc.createdAt?.toDate?.()?.toISOString?.() ??
        (videoDoc.createdAt ? new Date(videoDoc.createdAt).toISOString() : null);
      const confirmedAt =
        a.confirmedAt?.toDate?.()?.toISOString?.() ??
        a.createdAt?.toDate?.()?.toISOString?.() ??
        null;

      return {
        analysisId: d.id,
        videoId: a.videoId,
        childId,
        videoUploadedAt,
        confirmedAt,
        senderRole: (videoDoc.role ?? "teacher") as "parent" | "teacher" | "admin",
        fileName: `${d.id}.pdf`,
        hpdt: {
          overall:   a.frameAnalysis?.hpdt?.overall   ?? a.hpdt?.overall   ?? 0,
          social:    a.frameAnalysis?.hpdt?.social    ?? a.hpdt?.social    ?? 0,
          cognitive: a.frameAnalysis?.hpdt?.cognitive ?? a.hpdt?.cognitive ?? 0,
          behavior:  a.frameAnalysis?.hpdt?.behavior  ?? a.hpdt?.behavior  ?? 0,
          sensory:   a.frameAnalysis?.hpdt?.sensory   ?? a.hpdt?.sensory   ?? 0,
          motor:     a.frameAnalysis?.hpdt?.motor     ?? a.hpdt?.motor     ?? 0,
        },
        regulationLevel: a.summary?.regulationLevel ?? "transitioning",
        dominantBehavior: a.summary?.dominantBehavior ?? "",
        summary: a.summary?.overallRecommendation ?? "",
        keyInsights: a.summary?.keyInsights ?? [],
        approach: a.interventionPlan?.approach ?? [],
        goals: a.interventionPlan?.goals ?? [],
        collaborationMessage: a.interventionPlan?.collaborationMessage ?? "",
        lessonCount: (a.interventionPlan?.lessons ?? []).length,
        // Include video metadata for display
        videoLocation: videoDoc.location ?? "",
        videoTopic: videoDoc.topic ?? "",
        videoStatus: videoDoc.status ?? "",
      };
    });

    // Sort ascending — prefer videoUploadedAt, fall back to confirmedAt
    logs.sort((a, b) => {
      const da = new Date(a.videoUploadedAt ?? a.confirmedAt ?? 0).getTime();
      const db2 = new Date(b.videoUploadedAt ?? b.confirmedAt ?? 0).getTime();
      return da - db2;
    });

    // Build HPDT trend series (used by parent chart)
    const hpdtTrend = logs
      .filter((l) => l.hpdt.overall > 0)
      .map((l) => ({
        date: l.videoUploadedAt
          ? new Date(l.videoUploadedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
          : "—",
        overall: l.hpdt.overall,
        social: l.hpdt.social,
        cognitive: l.hpdt.cognitive,
        behavior: l.hpdt.behavior,
        sensory: l.hpdt.sensory,
        motor: l.hpdt.motor,
      }));

    return NextResponse.json({ logs, hpdtTrend });
  } catch (err) {
    console.error("[child-analysis-log]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
