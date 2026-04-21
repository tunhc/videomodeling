import { NextRequest, NextResponse } from "next/server";
import {
  analyzeVideoFrames,
  generateInterventionFromAnalysis,
  generateReportContent,
  type FullVideoAnalysis,
  type VideoAnalysisResult,
  type ReportContent,
} from "@/lib/claude";
import { cloudinaryService } from "@/lib/services/cloudinaryService";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc, setDoc, limit,
} from "firebase/firestore";

export const runtime = "nodejs";
export const maxDuration = 300;

const toStringSafe = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

const toNumberSafe = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

function buildFallbackFullAnalysis(
  frameAnalysis: VideoAnalysisResult,
  videoDuration: number
): FullVideoAnalysis {
  const duration = Math.max(15, Math.round(videoDuration || 60));
  const tags = Array.isArray(frameAnalysis?.tags)
    ? frameAnalysis.tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
    : [];

  const summaryText = toStringSafe(frameAnalysis?.summary, "Không thể phân tích chuyên sâu, đang dùng kết quả cơ bản.");
  const suggestedNote = toStringSafe(
    frameAnalysis?.suggestedNote,
    "Tiếp tục theo dõi thêm 1 video ngắn trong bối cảnh tương tự để cập nhật kế hoạch can thiệp."
  );

  return {
    segments: [
      {
        segmentId: "seg_001",
        startTime: 0,
        endTime: duration,
        motionLevel: "medium",
        motionScore: 50,
        behaviorType: "skill_attempt",
        behaviorLabel: tags[0] ?? "Hoạt động can thiệp",
        functionalAnalysis: summaryText,
        interventionHint: suggestedNote,
      },
    ],
    summary: {
      dominantBehavior: tags[0] ?? "Không xác định",
      regulationLevel: "transitioning",
      keyInsights: tags.slice(0, 3),
      overallRecommendation: suggestedNote,
    },
    interventionPlan: {
      approach: ["ABA", "DIR", "OT", "VM"],
      goals: [],
      lessons: [],
      collaborationMessage: suggestedNote,
    },
  };
}

function normalizeFullAnalysis(
  raw: FullVideoAnalysis,
  frameAnalysis: VideoAnalysisResult,
  videoDuration: number
): FullVideoAnalysis {
  const fallback = buildFallbackFullAnalysis(frameAnalysis, videoDuration);
  const source = raw && typeof raw === "object" ? (raw as unknown as Record<string, unknown>) : {};

  const rawSegments = Array.isArray(source.segments) && source.segments.length > 0
    ? source.segments
    : fallback.segments;

  const segments = rawSegments.map((segment, index) => {
    const seg = segment && typeof segment === "object" ? (segment as Record<string, unknown>) : {};
    const startTime = Math.max(0, Math.round(toNumberSafe(seg.startTime, index * 10)));
    const fallbackEnd = Math.min(Math.max(videoDuration, startTime + 1), startTime + 20);
    const endTime = Math.max(startTime + 1, Math.round(toNumberSafe(seg.endTime, fallbackEnd)));
    const motionRaw = toStringSafe(seg.motionLevel, "medium").toLowerCase();
    const motionLevel: "high" | "medium" | "low" =
      motionRaw === "high" ? "high" : motionRaw === "low" ? "low" : "medium";
    const motionScore = Math.min(100, Math.max(0, Math.round(toNumberSafe(seg.motionScore, 50))));

    return {
      segmentId: toStringSafe(seg.segmentId, `seg_${String(index + 1).padStart(3, "0")}`),
      startTime,
      endTime,
      motionLevel,
      motionScore,
      behaviorType: toStringSafe(seg.behaviorType, "skill_attempt"),
      behaviorLabel: toStringSafe(seg.behaviorLabel, "Quan sát hành vi"),
      functionalAnalysis: toStringSafe(seg.functionalAnalysis, fallback.summary.overallRecommendation),
      interventionHint: toStringSafe(seg.interventionHint, fallback.interventionPlan.collaborationMessage),
    };
  });

  const rawSummary = source.summary && typeof source.summary === "object"
    ? (source.summary as Record<string, unknown>)
    : {};
  const regulationRaw = toStringSafe(rawSummary.regulationLevel, "transitioning").toLowerCase();
  const regulationLevel: "dysregulated" | "transitioning" | "regulated" =
    regulationRaw === "dysregulated" || regulationRaw === "regulated"
      ? regulationRaw
      : "transitioning";
  const keyInsights = Array.isArray(rawSummary.keyInsights)
    ? rawSummary.keyInsights
        .map((item) => toStringSafe(item, ""))
        .filter(Boolean)
        .slice(0, 5)
    : fallback.summary.keyInsights;

  const rawPlan = source.interventionPlan && typeof source.interventionPlan === "object"
    ? (source.interventionPlan as Record<string, unknown>)
    : {};

  const approach = Array.isArray(rawPlan.approach)
    ? rawPlan.approach.map((item) => toStringSafe(item, "")).filter(Boolean)
    : fallback.interventionPlan.approach;

  const goals = Array.isArray(rawPlan.goals)
    ? rawPlan.goals.map((goal, index) => {
        const item = goal && typeof goal === "object" ? (goal as Record<string, unknown>) : {};
        return {
          goalId: toStringSafe(item.goalId, `goal_${String(index + 1).padStart(3, "0")}`),
          domain: toStringSafe(item.domain, "behavior"),
          targetBehavior: toStringSafe(item.targetBehavior, "Cải thiện hành vi mục tiêu"),
          smartGoal: toStringSafe(item.smartGoal, "Đạt 80% tiêu chí trong 4 tuần"),
          timeframe: toStringSafe(item.timeframe, "4 tuần"),
        };
      })
    : [];

  const lessons = Array.isArray(rawPlan.lessons)
    ? rawPlan.lessons.map((lesson, lessonIndex) => {
        const item = lesson && typeof lesson === "object" ? (lesson as Record<string, unknown>) : {};
        const rawSteps = Array.isArray(item.steps) ? item.steps : [];
        const steps = rawSteps.map((step, stepIndex) => {
          const stepItem = step && typeof step === "object" ? (step as Record<string, unknown>) : {};
          const promptRaw = toStringSafe(stepItem.promptLevel, "partial").toLowerCase();
          const promptLevel: "full" | "partial" | "gesture" | "independent" =
            promptRaw === "full" || promptRaw === "gesture" || promptRaw === "independent"
              ? promptRaw
              : "partial";
          return {
            stepId: toStringSafe(stepItem.stepId, `step_${String(stepIndex + 1).padStart(3, "0")}`),
            order: Math.max(1, Math.round(toNumberSafe(stepItem.order, stepIndex + 1))),
            title: toStringSafe(stepItem.title, `Bước ${stepIndex + 1}`),
            description: toStringSafe(stepItem.description, "Thực hiện theo hướng dẫn chuyên viên."),
            duration: Math.max(1, Math.round(toNumberSafe(stepItem.duration, 5))),
            promptLevel,
            therapistAction: toStringSafe(stepItem.therapistAction, "Người lớn hỗ trợ và củng cố tích cực."),
            childAction: toStringSafe(stepItem.childAction, "Trẻ thực hiện nhiệm vụ theo từng bước."),
          };
        });

        const rawChecklist = Array.isArray(item.checklist) ? item.checklist : [];
        const checklist = rawChecklist.map((entry, entryIndex) => {
          const check = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
          const categoryRaw = toStringSafe(check.category, "target").toLowerCase();
          const category: "prerequisite" | "target" | "generalization" =
            categoryRaw === "prerequisite" || categoryRaw === "generalization"
              ? categoryRaw
              : "target";
          return {
            itemId: toStringSafe(check.itemId, `chk_${String(entryIndex + 1).padStart(3, "0")}`),
            description: toStringSafe(check.description, "Hoàn thành mục tiêu trong buổi can thiệp."),
            category,
            masteryTarget: Math.min(100, Math.max(0, Math.round(toNumberSafe(check.masteryTarget, 80)))),
          };
        });

        const forRoleRaw = toStringSafe(item.forRole, "both").toLowerCase();
        const forRole: "teacher" | "parent" | "both" =
          forRoleRaw === "teacher" || forRoleRaw === "parent" ? forRoleRaw : "both";

        return {
          lessonId: toStringSafe(item.lessonId, `lesson_${String(lessonIndex + 1).padStart(3, "0")}`),
          title: toStringSafe(item.title, `Bài học ${lessonIndex + 1}`),
          goalRef: toStringSafe(item.goalRef, ""),
          lessonType: toStringSafe(item.lessonType, "video_modeling"),
          vmType: toStringSafe(item.vmType, "basic_vm"),
          rationale: toStringSafe(item.rationale, "Dựa trên dữ liệu phân tích video hiện tại."),
          steps,
          checklist,
          masteryThreshold: Math.min(100, Math.max(0, Math.round(toNumberSafe(item.masteryThreshold, 80)))),
          estimatedSessions: Math.max(1, Math.round(toNumberSafe(item.estimatedSessions, 10))),
          forRole,
        };
      })
    : [];

  const collaborationMessage = toStringSafe(
    rawPlan.collaborationMessage,
    fallback.interventionPlan.collaborationMessage
  );

  return {
    segments,
    summary: {
      dominantBehavior: toStringSafe(rawSummary.dominantBehavior, fallback.summary.dominantBehavior),
      regulationLevel,
      keyInsights,
      overallRecommendation: toStringSafe(
        rawSummary.overallRecommendation,
        fallback.summary.overallRecommendation
      ),
    },
    interventionPlan: {
      approach: approach.length > 0 ? approach : fallback.interventionPlan.approach,
      goals,
      lessons,
      collaborationMessage,
    },
  };
}

function buildFallbackReportContent(
  frameAnalysis: VideoAnalysisResult,
  fullAnalysis: FullVideoAnalysis,
  video: Record<string, unknown>
): ReportContent {
  const tags = Array.isArray(frameAnalysis?.tags)
    ? frameAnalysis.tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
    : [];
  const lessons = Array.isArray(fullAnalysis.interventionPlan.lessons)
    ? fullAnalysis.interventionPlan.lessons
    : [];

  return {
    videoObservations: [
      { label: "Bối cảnh", value: toStringSafe(video.context ?? video.location, "Không rõ") },
      { label: "Hành vi quan sát", value: tags.join(", ") || "Chưa xác định" },
    ],
    behaviourAnalysis: toStringSafe(frameAnalysis?.summary, "Không đủ dữ liệu để kết luận chuyên sâu."),
    interventionStrategy: `Áp dụng kết hợp ${(fullAnalysis.interventionPlan.approach || []).join(", ")} và theo dõi lại sau mỗi buổi.`,
    monthlyPlan: [
      {
        period: "Tuần 1-2",
        focus: "Thiết lập nền tảng",
        activities: ["Thực hành bài tập ngắn hằng ngày", "Theo dõi hành vi mục tiêu"],
      },
      {
        period: "Tuần 3-4",
        focus: "Củng cố kỹ năng",
        activities: ["Tăng mức độ độc lập", "Đánh giá lại tiến triển"],
      },
    ],
    exercises: lessons.slice(0, 5).map((lesson, index) => ({
      number: index + 1,
      title: lesson.title,
      basedOn: lesson.rationale,
      therapies: fullAnalysis.interventionPlan.approach,
      objective: lesson.checklist[0]?.description || "Cải thiện kỹ năng mục tiêu",
      steps: lesson.steps.map((step) => `${step.title}: ${step.description}`),
      targetGoals: lesson.checklist.map((item) => item.description),
    })),
    clinicalNote: toStringSafe(
      frameAnalysis?.suggestedNote,
      "Tiếp tục can thiệp có cấu trúc và ghi lại thêm video theo cùng bối cảnh để so sánh tiến bộ."
    ),
  };
}

// ── GET: fetch existing analysis for a video ───────────────────────────────
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }

  try {
    const snap = await getDocs(
      query(collection(db, "video_analysis"), where("videoId", "==", videoId))
    );

    if (snap.empty) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sorted = snap.docs.sort((a, b) => {
      const ta = (a.data().createdAt?.toMillis?.() as number) ?? 0;
      const tb = (b.data().createdAt?.toMillis?.() as number) ?? 0;
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
      senderRole?: "parent" | "teacher" | "system";
      childState?: string;
      locationNote?: string;
    };

    if (!videoId || !childId) {
      return NextResponse.json(
        { error: "videoId and childId are required" },
        { status: 400 }
      );
    }

    const [videoSnap, childSnap, hpdtSnap] = await Promise.all([
      getDoc(doc(db, "video_modeling", videoId)),
      getDoc(doc(db, "children", childId)),
      getDocs(query(collection(db, "hpdt_stats"), where("childId", "==", childId), limit(1))),
    ]);

    if (!videoSnap.exists()) {
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
    const generatedFullAnalysis: FullVideoAnalysis = await generateInterventionFromAnalysis(
      frameAnalysis,
      enrichedVideo,
      child,
      childId,
      hpdt
    );

    const fullAnalysis = normalizeFullAnalysis(
      generatedFullAnalysis,
      frameAnalysis,
      typeof video.duration === "number" ? video.duration : 60
    );

    // ── Phase 3: Clinical report content (for PDF export) ───────────────────
    let reportContent: ReportContent;
    try {
      reportContent = await generateReportContent(
        frameAnalysis,
        fullAnalysis,
        enrichedVideo,
        child,
        childId
      );
    } catch (reportErr) {
      console.error("[analyze-video][report-fallback]", reportErr);
      reportContent = buildFallbackReportContent(
        frameAnalysis,
        fullAnalysis,
        enrichedVideo as Record<string, unknown>
      );
    }

    // ── Save to Firestore ───────────────────────────────────────────────────
    const now = new Date();
    const analysisId = `VA_${childId}_${Date.now()}`;

    await setDoc(doc(db, "video_analysis", analysisId), {
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
