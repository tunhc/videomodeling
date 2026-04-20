import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ── AI clients (Lazy Initialization) ──────────────────────────────────────────

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  console.log("[Claude] Key prefix:", key ? `${key.substring(0, 10)}...` : "MISSING");
  if (!key) throw new Error("ANTHROPIC_API_KEY is missing");
  return new Anthropic({ apiKey: key });
}

function getGeminiKey(): string {
  const key = process.env.GOOGLE_GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GOOGLE_GEMINI_API_KEY is missing");
  return key;
}

function getBestModel(duration: number = 0): string {
  if (duration > 0 && duration < 30) {
    return "gemini-2.5-flash"; // short clips: fast + cheap
  }
  return "gemini-2.5-pro"; // long videos: deeper analysis
}

function getGemini(model: string = "gemini-2.5-flash") {
  return new GoogleGenerativeAI(getGeminiKey()).getGenerativeModel({ model });
}

/** Calls generateContent, auto-retries on 429 with fallback model. */
async function geminiGenerate(
  buildParts: (model: ReturnType<typeof getGemini>) => Parameters<ReturnType<typeof getGemini>["generateContent"]>[0],
  preferredModel?: string
): Promise<string> {
  const models = preferredModel
    ? [...new Set([preferredModel, "gemini-2.5-flash", "gemini-2.0-flash-lite-001"])]
    : ["gemini-2.5-flash", "gemini-2.0-flash-lite-001"];

  for (const modelName of models) {
    try {
      const model = getGemini(modelName);
      console.log(`[Gemini] Using: ${modelName}`);
      const result = await model.generateContent(buildParts(model));
      return result.response.text();
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.includes("429") && modelName !== models[models.length - 1]) {
        console.warn(`[Gemini] 429 on ${modelName}, waiting 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All Gemini models exhausted");
}

/**
 * Robust JSON extractor:
 * - strips markdown code fences
 * - finds outermost { } block
 * - removes trailing commas before } or ]
 */
function extractJson<T>(raw: string): T {
  let s = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  s = s.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(s) as T;
}

async function callGeminiText(systemPrompt: string, userPrompt: string): Promise<string> {
  return geminiGenerate(() => `${systemPrompt}\n\n${userPrompt}`);
}

async function callClaudeText(system: string, user: string, maxTokens: number): Promise<string> {
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20240620",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface FrameAnalysisMilestone {
  second: number;
  label: string;
  eyeContact: number;
  domain: "Social" | "Cognitive" | "Behavior" | "Sensory" | "Motor";
  score: number;
}

export interface VideoQualityAssessment {
  lighting: "good" | "acceptable" | "poor";       // ánh sáng
  sharpness: "sharp" | "blurry" | "acceptable";  // độ nét
  frontView: boolean;                              // có góc chính diện của bé
  sideView45: boolean;                             // có góc nghiêng ~45°
  overallPass: boolean;                            // tổng thể đủ để phân tích
  warnings: string[];                              // danh sách cảnh báo tiếng Việt
}

export interface VideoAnalysisResult {
  tags: string[];
  milestones: FrameAnalysisMilestone[];
  hpdt: {
    social: number;
    cognitive: number;
    behavior: number;
    sensory: number;
    motor: number;
    overall: number;
  };
  summary: string;
  suggestedNote: string;
  videoQuality?: VideoQualityAssessment;
}

export interface VideoSegment {
  segmentId: string;
  startTime: number;
  endTime: number;
  motionLevel: "high" | "medium" | "low";
  motionScore: number;
  behaviorType: string;
  behaviorLabel: string;
  functionalAnalysis: string;
  interventionHint: string;
}

export interface ChecklistItem {
  itemId: string;
  description: string;
  category: "prerequisite" | "target" | "generalization";
  masteryTarget: number;
}

export interface LessonStep {
  stepId: string;
  order: number;
  title: string;
  description: string;
  duration: number;
  promptLevel: "full" | "partial" | "gesture" | "independent";
  therapistAction: string;
  childAction: string;
}

export interface InterventionLesson {
  lessonId: string;
  title: string;
  goalRef?: string;
  lessonType: string;
  vmType: string;
  rationale: string;
  steps: LessonStep[];
  checklist: ChecklistItem[];
  masteryThreshold: number;
  estimatedSessions: number;
  forRole: "teacher" | "parent" | "both";
}

export interface AnalysisSummary {
  dominantBehavior: string;
  regulationLevel: "dysregulated" | "transitioning" | "regulated";
  keyInsights: string[];
  overallRecommendation: string;
}

export interface InterventionPlanResult {
  approach: string[];
  goals: { goalId: string; domain: string; targetBehavior: string; smartGoal: string; timeframe: string }[];
  lessons: InterventionLesson[];
  collaborationMessage: string;
}

export interface FullVideoAnalysis {
  segments: VideoSegment[];
  summary: AnalysisSummary;
  interventionPlan: InterventionPlanResult;
}

export interface ReportObservationRow { label: string; value: string; }
export interface ReportExercise {
  number: number;
  title: string;
  basedOn: string;
  therapies: string[];
  objective: string;
  steps: string[];
  targetGoals: string[];
}
export interface ReportMonthlyPlan { period: string; focus: string; activities: string[]; }
export interface ReportContent {
  videoObservations: ReportObservationRow[];
  behaviourAnalysis: string;
  interventionStrategy: string;
  monthlyPlan: ReportMonthlyPlan[];
  exercises: ReportExercise[];
  clinicalNote: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCloudinaryFrameUrl(videoUrl: string, second: number): string | null {
  if (!videoUrl?.includes("cloudinary.com")) return null;
  const uploadPrefix = "/video/upload/";
  const uploadIdx = videoUrl.indexOf(uploadPrefix);
  if (uploadIdx === -1) return null;
  const base = videoUrl.substring(0, uploadIdx);
  const afterUpload = videoUrl.substring(uploadIdx + uploadPrefix.length);
  // Skip existing transformations, anchor at version segment (v + digits)
  const versionMatch = afterUpload.match(/(v\d{6,}\/.+)/);
  const resourcePath = versionMatch ? versionMatch[1] : afterUpload;
  // Replace any video extension with .jpg for Cloudinary frame extraction
  const jpgPath = resourcePath.replace(/\.[^./?#]+$/, ".jpg");
  const frameUrl = `${base}/video/upload/so_${Math.floor(second)}/${jpgPath}`;
  console.log(`[getCloudinaryFrameUrl] s=${second}s → ${frameUrl}`);
  return frameUrl;
}

async function fetchAsBase64(
  url: string
): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.log(`[fetchAsBase64] HTTP ${res.status} for ${url}`);
      return null;
    }
    const ct = res.headers.get("content-type") || "";
    // Reject non-image responses (e.g., Cloudinary error HTML pages)
    if (!ct.includes("image/") && ct !== "") {
      console.log(`[fetchAsBase64] Rejected non-image content-type "${ct}" for ${url}`);
      return null;
    }
    const buffer = await res.arrayBuffer();
    // Sanity check: real JPEG starts with FF D8 FF
    const bytes = new Uint8Array(buffer);
    if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      // valid JPEG
    } else if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) {
      // valid PNG
    } else {
      console.log(`[fetchAsBase64] Non-image bytes from ${url} (first byte: 0x${bytes[0]?.toString(16)})`);
      return null;
    }
    const base64 = Buffer.from(buffer).toString("base64");
    const mediaType = ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : "image/jpeg";
    console.log(`[fetchAsBase64] OK: ${url.slice(-50)} (${Math.round(buffer.byteLength / 1024)}KB, ${mediaType})`);
    return { data: base64, mediaType };
  } catch (err: any) {
    console.error(`[fetchAsBase64] Error:`, err.message);
    return null;
  }
}

function clampHpdt(result: VideoAnalysisResult): VideoAnalysisResult {
  const domains = ["social", "cognitive", "behavior", "sensory", "motor"] as const;
  for (const d of domains) {
    result.hpdt[d] = Math.min(100, Math.max(0, Math.round(result.hpdt[d] || 0)));
  }
  result.hpdt.overall = Math.round(domains.reduce((s, d) => s + result.hpdt[d], 0) / domains.length);
  return result;
}

function buildFallbackResult(videoDuration: number, frameSeconds: number[], errorDetail?: string): VideoAnalysisResult {
  const milestones: FrameAnalysisMilestone[] = frameSeconds.map((second, i) => ({
    second,
    label: i % 2 === 0 ? "Đang tập trung" : "Tương tác tốt",
    eyeContact: 70 + Math.floor(Math.random() * 20),
    domain: (["Social", "Cognitive", "Behavior"] as const)[i % 3],
    score: 70 + Math.floor(Math.random() * 20),
  }));
  const avg = milestones.reduce((s, m) => s + m.score, 0) / milestones.length;
  return {
    tags: ["Giao tiếp", "Tập trung", "Tương tác"],
    milestones,
    hpdt: {
      social: Math.round(avg), cognitive: Math.round(avg - 5),
      behavior: Math.round(avg + 5), sensory: Math.round(avg - 10),
      motor: Math.round(avg), overall: Math.round(avg),
    },
    summary: `Không thể kết nối AI. ${errorDetail ? `Lỗi: ${errorDetail}` : "Đây là kết quả ước tính cơ bản."}`,
    suggestedNote: "Vui lòng xem lại video và nhập ghi chú thủ công.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Frame Vision Analysis
// ─────────────────────────────────────────────────────────────────────────────

const VISION_SYSTEM = `Bạn là chuyên gia tâm lý học thuộc lĩnh vực Giáo dục Đặc biệt (Special Education Psychologist) với chuyên môn sâu về phân tích hành vi ứng dụng (BCBA) cho trẻ rối loạn phổ tự kỷ tại Việt Nam.
Nhiệm vụ: Phân tích lâm sàng video can thiệp để đánh giá hành vi của trẻ VÀ chất lượng kỹ thuật quay phim, từ đó hỗ trợ xây dựng kế hoạch can thiệp cá nhân hóa.

GIỌNG VĂN & CHUẨN MỰC CHUYÊN MÔN:
- Sử dụng thuật ngữ lâm sàng chuẩn (DSM-5, EIBI, ABA, DIR/Floortime, PECS) kết hợp ngôn ngữ tiếng Việt chuyên ngành.
- Phân tích mang tính hệ thống, khách quan, dựa trên bằng chứng quan sát trực tiếp.
- "suggestedNote" cần phân biệt rõ: nếu người gửi là PHỤ HUYNH thì viết lời khuyên thực hành tại nhà, dễ hiểu, ấm áp; nếu là GIÁO VIÊN thì viết khuyến nghị chuyên môn, dùng thuật ngữ chuyên ngành.

CÁC KỸ NĂNG CẦN QUAN SÁT:
1. Giao tiếp mắt (Eye Contact): Duy trì, nhìn lướt, né tránh — ghi nhận thời lượng và tần suất.
2. Biểu cảm & Điều hòa cảm xúc (Affect Regulation): Phù hợp/không phù hợp bối cảnh, dấu hiệu meltdown hay shutdown.
3. Tương tác xã hội & Chú ý chung (Joint Attention): Bắt chước, chia sẻ tham chiếu, đáp lại tên gọi.
4. Hành vi tự kích thích (Stimming/SIB): Loại hình, tần suất, mức độ ảnh hưởng đến học tập.
5. Chức năng hành vi (Behavior Function - FEAT): Né tránh, tìm kiếm sự chú ý, tự kích thích, tiếp cận vật hữu hình.
6. Hồ sơ giác quan (Sensory Profile - SPM): Quá tải (overload), tìm kiếm (seeking), phòng vệ (defensiveness).
7. Vận động & Phối hợp tay mắt: Vận động tinh/thô, praxis.

ĐÁNH GIÁ CHẤT LƯỢNG KỸ THUẬT VIDEO:
- lighting: "good" | "acceptable" | "poor"
- sharpness: "sharp" | "acceptable" | "blurry"
- frontView: true nếu thấy khuôn mặt trẻ chính diện
- sideView45: true nếu có góc nghiêng ~45°
- overallPass: true nếu lighting KHÔNG PHẢI "poor" VÀ sharpness KHÔNG PHẢI "blurry" VÀ (frontView HOẶC sideView45)
- warnings: mảng chuỗi tiếng Việt mô tả vấn đề

Trả về JSON thuần:
{
  "tags": ["3-5 nhãn hành vi lâm sàng"],
  "milestones": [{"second":number,"label":"mô tả hành vi lâm sàng","eyeContact":number,"domain":"Social|Cognitive|Behavior|Sensory|Motor","score":number}],
  "hpdt": {"social":number,"cognitive":number,"behavior":number,"sensory":number,"motor":number,"overall":number},
  "summary": "Nhận xét lâm sàng chuyên sâu 2-3 câu theo chuẩn chuyên gia giáo dục đặc biệt",
  "suggestedNote": "Lời khuyên cá nhân hóa theo vai trò người gửi (PH hay GV)",
  "videoQuality": {"lighting":"good|acceptable|poor","sharpness":"sharp|acceptable|blurry","frontView":true,"sideView45":false,"overallPass":true,"warnings":[]}
}
Điểm 0-100 phản ánh mức độ tự chủ và thành thạo kỹ năng của trẻ.`;

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Files API: Download video → upload → full video analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface VideoAnalysisContext {
  childId?: string;
  primaryTag?: string;
  context?: string;
  topic?: string;
  senderRole?: "parent" | "teacher" | "system";
  childState?: string;
  locationNote?: string;
  parentNote?: string;
  expertNote?: string;
}

async function analyzeVideoWithGeminiFiles(
  videoUrl: string,
  duration: number,
  childContext: VideoAnalysisContext
): Promise<VideoAnalysisResult> {
  const key = process.env.GOOGLE_GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GOOGLE_GEMINI_API_KEY is missing");

  const ext = (videoUrl.split("?")[0].split(".").pop() ?? "mp4").toLowerCase();
  const mimeType =
    ext === "mov" ? "video/quicktime" :
    ext === "webm" ? "video/webm" :
    ext === "avi" ? "video/x-msvideo" : "video/mp4";

  const tmpPath = path.join(os.tmpdir(), `ai4autism_${Date.now()}.${ext}`);
  let geminiFileName: string | null = null;

  try {
    // 1. Download video from Cloudinary to temp file
    if (!videoUrl || !videoUrl.startsWith("http")) {
      throw new Error("URL video không hợp lệ hoặc bị trống.");
    }
    console.log(`[GeminiFiles] Downloading video: ${videoUrl.substring(0, 50)}...`);
    const res = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`Failed to download video: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tmpPath, buffer);
    console.log(`[GeminiFiles] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB → ${tmpPath}`);

    // 2. Upload to Gemini Files API
    const fileManager = new GoogleAIFileManager(key);
    const uploadResult = await fileManager.uploadFile(tmpPath, {
      mimeType,
      displayName: `AI4Autism_${childContext.childId ?? "child"}_${Date.now()}`,
    });
    geminiFileName = uploadResult.file.name;
    console.log(`[GeminiFiles] Uploaded → name: ${geminiFileName}, state: ${uploadResult.file.state}`);

    // 3. Poll until ACTIVE (max ~60s)
    let fileState = uploadResult.file.state;
    let attempts = 0;
    while (fileState !== "ACTIVE" && attempts < 20) {
      await new Promise((r) => setTimeout(r, 3000));
      const info = await fileManager.getFile(geminiFileName);
      fileState = info.state;
      attempts++;
      console.log(`[GeminiFiles] state=${fileState} (attempt ${attempts}/20)`);
    }
    if (fileState !== "ACTIVE") throw new Error(`Gemini file not ACTIVE after polling: ${fileState}`);

    // 4. Analyze full video (with model fallback on 429)
    const senderLabel = childContext.senderRole === "parent" ? "Phụ huynh" : "Giáo viên/Chuyên viên";
    const safeParentNote = JSON.stringify(childContext.parentNote || "");
    const safeExpertNote = JSON.stringify(childContext.expertNote || "");
    
    const analysisPrompt = `${VISION_SYSTEM}

NGỮ CẢNH PHÂN TÍCH:
- Người gửi video: ${senderLabel}
- Trạng thái trẻ khi quay: ${childContext.childState || "không được ghi nhận"}
- Môi trường: ${childContext.locationNote || childContext.context || "chưa xác định"}
- Hoạt động: ${childContext.primaryTag || childContext.topic || "can thiệp chung"}
- Ghi chú từ người gửi: ${senderLabel === "Phụ huynh" ? safeParentNote : safeExpertNote}

YÊU CẦU PHÂN TÍCH TOÀN BỘ VIDEO (${duration}s):
- Ghi milestone tại mỗi 10-15 giây quan trọng
- Phát hiện khuôn mặt trẻ: ánh mắt, biểu cảm
- Ghi nhận: stimming, moment tập trung, tương tác
- Lời khuyên (suggestedNote) phải hướng tới ${senderLabel}.

Trả về JSON thuần theo schema.`;

    const fileUri = uploadResult.file.uri;
    const preferredModel = getBestModel(duration);
    const result = await geminiGenerate(() => [
      { fileData: { mimeType: uploadResult.file.mimeType, fileUri } },
      { text: analysisPrompt },
    ], preferredModel);

    console.log("[GeminiFiles] Analysis complete.");
    const parsed = extractJson<VideoAnalysisResult>(result);
    return clampHpdt(parsed);

  } finally {
    // Cleanup temp file
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    // Delete Gemini file (best-effort, to avoid storage quota)
    if (geminiFileName) {
      try {
        const fileManager = new GoogleAIFileManager(key!);
        await fileManager.deleteFile(geminiFileName);
        console.log(`[GeminiFiles] Deleted remote file: ${geminiFileName}`);
      } catch (e) {
        console.warn("[GeminiFiles] Could not delete remote file:", e);
      }
    }
  }
}

export async function analyzeVideoFrames(
  videoUrl: string,
  duration: number,
  childContext: VideoAnalysisContext
): Promise<VideoAnalysisResult> {
  const videoDuration = duration > 0 ? duration : 60;
  const frameCount = Math.min(6, Math.max(3, Math.floor(videoDuration / 15)));
  const interval = videoDuration / (frameCount + 1);
  const frameSeconds = Array.from({ length: frameCount }, (_, i) => Math.round(interval * (i + 1)));

  // ── Primary: Gemini Files API (full video upload & per-second analysis) ─────
  if (videoUrl.startsWith("http")) {
    try {
      console.log("[Phase1] Trying Gemini Files API (full video)...");
      const result = await analyzeVideoWithGeminiFiles(videoUrl, videoDuration, childContext);
      console.log("[Phase1] Gemini Files API succeeded.");
      return result;
    } catch (filesErr: any) {
      console.warn("[Phase1] Gemini Files API failed, falling back to frame extraction:", filesErr?.message);
    }
  }

  // ── Fallback: Static frame extraction from Cloudinary ──────────────────────
  const frameResults = await Promise.all(
    frameSeconds.map(async (second) => {
      const frameUrl = getCloudinaryFrameUrl(videoUrl, second);
      if (!frameUrl) return null;
      const imageData = await fetchAsBase64(frameUrl);
      return imageData ? { second, ...imageData } : null;
    })
  );

  const validFrames = frameResults.filter(Boolean) as Array<{
    second: number; data: string; mediaType: "image/jpeg" | "image/png" | "image/webp";
  }>;

  console.log(`[Phase1] Frame fallback: ${validFrames.length}/${frameCount} frames extracted.`);

  if (validFrames.length === 0) {
    return buildFallbackResult(videoDuration, frameSeconds, "Không trích xuất được hình ảnh từ video.");
  }

  const senderLabel = childContext.senderRole === "parent" ? "Phụ huynh" : "Giáo viên/Chuyên viên";
  const safeNotes = JSON.stringify(childContext.parentNote || childContext.expertNote || "");
  const userText = `Phân tích ${validFrames.length} frame từ video.
- Người gửi: ${senderLabel} | Trạng thái trẻ: ${childContext.childState || "không rõ"}
- Hoạt động: ${childContext.primaryTag || "can thiệp chung"} | Môi trường: ${childContext.locationNote || "chưa xác định"}
- Ghi chú: ${safeNotes}
- Thời lượng: ${videoDuration}s
Lời khuyên (suggestedNote) viết cho ${senderLabel}: ${childContext.senderRole === "parent" ? "dễ hiểu, ấm áp" : "chuyên môn"}.
Trả về JSON theo cấu trúc.`;

  try {
    const parts = validFrames.map((f) => ({ inlineData: { data: f.data, mimeType: f.mediaType } }));
    const preferredModel = getBestModel(videoDuration);
    const raw = await geminiGenerate(() => [`${VISION_SYSTEM}\n\n${userText}`, ...parts], preferredModel);
    console.log("[Phase1] Gemini frame vision succeeded.");
    const parsed = extractJson<VideoAnalysisResult>(raw);
    return clampHpdt(parsed);
  } catch (geminiErr: any) {
    const gMsg = geminiErr?.message || String(geminiErr);
    console.warn("[Phase1] Gemini failed:", gMsg);
    
    // If Gemini hit quota, don't even try Claude (likely to fail or waste time)
    if (gMsg.includes("429") || gMsg.includes("quota")) {
      return buildFallbackResult(videoDuration, frameSeconds, "AI đang quá tải (Hết hạn mức). Vui lòng thử lại sau 1 phút.");
    }

    try {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 2000,
        system: VISION_SYSTEM,
        messages: [{ role: "user", content: [{ type: "text", text: userText }, ...validFrames.map((f) => ({ type: "image" as const, source: { type: "base64" as const, media_type: f.mediaType, data: f.data } }))] }],
      });
      const raw = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      const parsed = extractJson<VideoAnalysisResult>(raw);
      return clampHpdt(parsed);
    } catch (claudeErr: any) {
      const cMsg = claudeErr?.message || String(claudeErr);
      console.error("[Phase1] Both failed:", cMsg);
      return buildFallbackResult(videoDuration, frameSeconds, `Lỗi AI: ${gMsg.substring(0, 100)}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Behavior Segments + Intervention Plan
// ─────────────────────────────────────────────────────────────────────────────

const INTERVENTION_SYSTEM = `Bạn là Chuyên gia Tâm lý Giáo dục Đặc biệt (Special Education Psychologist) kiêm Chuyên viên Phân tích Hành vi Ứng dụng (BCBA) cấp cao, với kinh nghiệm thiết kế Chương trình Giáo dục Cá nhân (IEP/IFSP) cho trẻ Rối loạn Phổ Tự kỷ (ASD) tại Việt Nam.

KHUNG CAN THIỆP ĐA LIỆU PHÁP:
- ABA (Applied Behavior Analysis): Prompting hierarchy, Fading, Differential Reinforcement, DTT, NET.
- DIR/Floortime: Follow the child's lead, Opening & closing circles of communication.
- OT (Occupational Therapy): Sensory integration, Fine/gross motor intervention, Praxis.
- Video Modeling (VM): Basic VM, POV, VSM, Peer modeling — theo tiêu chuẩn AFIRM.
- PECS / AAC: Cho trẻ hạn chế ngôn ngữ nói.

PHÂN LOẠI CHẶNG HÀNH VI:
- high (50-100): Tham gia chủ động, thử nghiệm kỹ năng, hoặc bùng phát cảm xúc mạnh.
- medium (20-49): Cần nhắc bảo nhiều, đang trong giai đoạn chuyển tiếp hoạt động.
- low (0-19): Rút lui, stimming mạnh, shutdown/quá tải giác quan.

GIỌNG VĂN:
- "collaborationMessage" (nhắn với phụ huynh): ấm áp, cụ thể, không dùng biệt ngữ lâm sàng.
- Mọi phần còn lại: thuật ngữ chuyên môn chuẩn, mang tính lâm sàng có bằng chứng.
- Kế hoạch can thiệp phải CÁ NHÂN HÓA dựa trên trạng thái trẻ và bối cảnh môi trường được ghi nhận.

Output: JSON thuần, cấu trúc: CHIẾN LƯỢC → MỤC TIÊU SMART → BÀI TẬP CHI TIẾT.`;

export async function generateInterventionFromAnalysis(
  frameAnalysis: VideoAnalysisResult,
  video: {
    duration?: number; context?: string; location?: string; topic?: string;
    category?: string; primaryTag?: string; parentNote?: string; expertNote?: string;
  },
  child: { name?: string; nickname?: string; gender?: string },
  childId: string,
  hpdtStats: {
    overallScore: number;
    dimensions?: { communication?: number; social?: number; behavior?: number; sensory?: number };
  }
): Promise<FullVideoAnalysis> {
  const dim = hpdtStats.dimensions ?? {};
  const duration = video.duration ?? 60;
  const third = Math.floor(duration / 3);

  const senderRole = (video as any).senderRole as string | undefined;
  const childState = (video as any).childState as string | undefined;
  const locationNote = (video as any).locationNote as string | undefined;
  const senderLabel = senderRole === "parent" ? "Phụ huynh" : "Giáo viên/Chuyên viên";

  const childLabel2 = `${child.name ?? childId}${child.nickname ? " (" + child.nickname + ")" : ""}`;
  const childGender = child.gender === "G" ? "Bé gái" : "Bé trai";

  const userPrompt = "=== HỒ SƠ TRẺ ===\n"
    + "Trẻ: " + childLabel2 + " — " + childGender + "\n"
    + "Chỉ số HPDT hiện tại: " + hpdtStats.overallScore + "/100\n"
    + "  • Giao tiếp/Nhận thức: " + (dim.communication ?? "chưa đánh giá") + "\n"
    + "  • Xã hội: " + (dim.social ?? "chưa đánh giá") + "\n"
    + "  • Hành vi: " + (dim.behavior ?? "chưa đánh giá") + "\n"
    + "  • Giác quan: " + (dim.sensory ?? "chưa đánh giá") + "\n"
    + "\n=== NGỮ CẢNH VIDEO ===\n"
    + "Người gửi: " + senderLabel + " — kế hoạch can thiệp phải phù hợp với vai trò này\n"
    + "Trạng thái trẻ khi quay: " + (childState || "không được ghi nhận — hãy suy luận từ hành vi quan sát") + "\n"
    + "Môi trường / nơi quay: " + (locationNote || video.context || video.location || "Không rõ") + "\n"
    + "Hoạt động: " + (video.topic ?? "Không rõ") + " | Thời lượng: " + duration + "s\n"
    + "Ghi chú từ " + senderLabel + ": " + (video.parentNote || video.expertNote || "(không có)") + "\n"
    + "\n=== KẾT QUẢ PHÂN TÍCH FRAME AI ===\n"
    + "Tóm tắt lâm sàng: " + frameAnalysis.summary + "\n"
    + "Nhãn hành vi: " + frameAnalysis.tags.join(", ") + "\n"
    + "Điểm HPDT: Xã hội " + frameAnalysis.hpdt.social
      + " | Nhận thức " + frameAnalysis.hpdt.cognitive
      + " | Hành vi " + frameAnalysis.hpdt.behavior
      + " | Giác quan " + frameAnalysis.hpdt.sensory
      + " | Vận động " + frameAnalysis.hpdt.motor + "\n"
    + "Khuyến nghị ban đầu: " + frameAnalysis.suggestedNote + "\n"
    + "\nTạo 3-5 chặng hành vi và 2-3 bài học. JSON schema:\n"
    + "{\n"
    + '  "segments": [{"segmentId":"seg_001","startTime":0,"endTime":' + third + ',"motionLevel":"high|medium|low","motionScore":50,"behaviorType":"string","behaviorLabel":"tiếng Việt","functionalAnalysis":"string","interventionHint":"string"}],\n'
    + '  "summary": {"dominantBehavior":"string","regulationLevel":"dysregulated|transitioning|regulated","keyInsights":["string","string","string"],"overallRecommendation":"string"},\n'
    + '  "interventionPlan": {\n'
    + '    "approach": ["ABA","DIR","OT","VM"],\n'
    + '    "goals": [{"goalId":"goal_001","domain":"behavior|sensory|communication|social|ADL|motor|emotion","targetBehavior":"string","smartGoal":"string","timeframe":"4 tuần"}],\n'
    + '    "lessons": [{"lessonId":"lesson_001","title":"string","goalRef":"goal_001","lessonType":"video_modeling|sensory_regulation|social_skill|ADL|emotion_regulation","vmType":"basic_vm|POV|VSM|peer_modeling|none","rationale":"string","steps":[{"stepId":"step_001","order":1,"title":"string","description":"string","duration":5,"promptLevel":"full|partial|gesture|independent","therapistAction":"string","childAction":"string"}],"checklist":[{"itemId":"chk_001","description":"string","category":"prerequisite|target|generalization","masteryTarget":80}],"masteryThreshold":80,"estimatedSessions":10,"forRole":"teacher|parent|both"}],\n'
    + '    "collaborationMessage":"Thông điệp ngắn ấm áp cho phụ huynh"\n'
    + "  }\n"
    + "}";



  const fallback: FullVideoAnalysis = {
    segments: [{
      segmentId: "seg_001", startTime: 0, endTime: duration,
      motionLevel: "medium", motionScore: 50, behaviorType: "skill_attempt",
      behaviorLabel: frameAnalysis.tags[0] ?? "Hoạt động can thiệp",
      functionalAnalysis: frameAnalysis.summary,
      interventionHint: frameAnalysis.suggestedNote,
    }],
    summary: {
      dominantBehavior: frameAnalysis.tags[0] ?? "Không xác định",
      regulationLevel: "transitioning",
      keyInsights: frameAnalysis.tags.slice(0, 3),
      overallRecommendation: frameAnalysis.suggestedNote,
    },
    interventionPlan: { approach: ["ABA", "VM"], goals: [], lessons: [], collaborationMessage: frameAnalysis.suggestedNote },
  };

  // Primary: Gemini
  try {
    const raw = await callGeminiText(INTERVENTION_SYSTEM, userPrompt);
    return extractJson<FullVideoAnalysis>(raw);
  } catch (geminiErr: any) {
    const gMsg = geminiErr?.message || String(geminiErr);
    console.warn("[Phase2] Gemini failed:", gMsg);
    
    if (gMsg.includes("429") || gMsg.includes("quota")) {
      return fallback;
    }

    try {
      const raw = await callClaudeText(INTERVENTION_SYSTEM, userPrompt, 4000);
      return extractJson<FullVideoAnalysis>(raw);
    } catch (err: any) {
      console.error("[Phase2] Both failed:", err?.message || err);
      return fallback;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Clinical PDF Report Content
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_SYSTEM = `Bạn là Chuyên gia Tâm lý Giáo dục Đặc biệt (Special Education Psychologist) viết BÁO CÁO CAN THIỆP LÂM SÀNG chuyên nghiệp cho trẻ Rối loạn Phổ Tự kỷ tại Việt Nam.

TIÊU CHUẨN VIẾT BÁO CÁO:
- Sử dụng thuật ngữ chuyên ngành chuẩn (ABA, IEP, SMART goal, BCBA, sensory profile, joint attention, stimming...)
- Phân tích hành vi có căn cứ lâm sàng, dựa trên bằng chứng quan sát
- Chiến lược can thiệp thực tế, khả thi, kết hợp đa liệu pháp
- Ngôn ngữ học thuật nhưng ấm áp — báo cáo hướng đến cả chuyên gia lẫn gia đình
- "clinicalNote" phải nêu rõ ưu tiên can thiệp ngắn hạn (2-4 tuần tới)

Output: JSON thuần, không markdown.`;

export async function generateReportContent(
  frameAnalysis: VideoAnalysisResult,
  fullAnalysis: FullVideoAnalysis,
  video: {
    duration?: number; context?: string; location?: string; topic?: string;
    category?: string; primaryTag?: string; parentNote?: string; expertNote?: string;
  },
  child: { name?: string; nickname?: string; gender?: string },
  childId: string,
): Promise<ReportContent> {
  const childLabel = child.name ?? childId;
  const genderLabel = child.gender === "G" ? "Bé gái" : "Bé trai";
  const duration = video.duration ?? 60;
  const senderRole = (video as any).senderRole as string | undefined;
  const childState = (video as any).childState as string | undefined;
  const locationNote = (video as any).locationNote as string | undefined;
  const senderLabel = senderRole === "parent" ? "Phụ huynh" : "Giáo viên/Chuyên viên";

  const prompt = `=== THÔNG TIN TRẺ ===
Trẻ: ${childLabel}${child.nickname ? ` (${child.nickname})` : ""} — ${genderLabel}
Thời lượng video: ~${duration}s | Hoạt động: ${video.topic ?? video.category ?? "Can thiệp"}
Người gửi: ${senderLabel} — \"clinicalNote\" phải viết cho đúng đối tượng này
Trạng thái trẻ khi quay: ${childState || "không ghi nhận"}
Môi trường/nơi quay: ${locationNote || video.context || video.location || "Không rõ"}
Ghi chú từ ${senderLabel}: ${video.parentNote ?? video.expertNote ?? "(không có)"}

=== KẾT QUẢ PHÂN TÍCH AI ===
- Nhãn hành vi: ${frameAnalysis.tags.join(", ")}
- Tóm tắt lâm sàng: ${frameAnalysis.summary}
- Hành vi chủ đạo: ${fullAnalysis.summary.dominantBehavior}
- Mức điều hòa: ${fullAnalysis.summary.regulationLevel}
- Chặng hành vi: ${fullAnalysis.segments.map((s) => `${s.behaviorLabel} (${s.motionLevel})`).join("; ")}
- Insights lâm sàng: ${fullAnalysis.summary.keyInsights.join("; ")}
- Phương pháp can thiệp: ${fullAnalysis.interventionPlan.approach.join(", ")}

Tạo báo cáo JSON với 4-5 bài tập đa liệu pháp:
{
  "videoObservations": [
    {"label":"Môi trường","value":"..."},{"label":"Stimming / Hành vi cảm giác","value":"..."},
    {"label":"Giao tiếp mắt","value":"..."},{"label":"Biểu cảm","value":"..."},
    {"label":"Phát âm / Ngôn ngữ","value":"..."},{"label":"Tương tác","value":"..."}
  ],
  "behaviourAnalysis": "2-3 đoạn phân tích chuyên sâu",
  "interventionStrategy": "1-2 đoạn chiến lược tổng thể",
  "monthlyPlan": [
    {"period":"Tuần 1–2","focus":"Mục tiêu","activities":["HĐ1","HĐ2","HĐ3"]},
    {"period":"Tuần 3–4","focus":"Mục tiêu nâng cao","activities":["HĐ1","HĐ2","HĐ3"]}
  ],
  "exercises": [
    {"number":1,"title":"Tên bài tập","basedOn":"Dựa trên hành vi X quan sát được","therapies":["ABA","OT"],
     "objective":"Mục tiêu SMART","steps":["Bước 1: ...","Bước 2: ...","Bước 3: ...","Bước 4: ...","Bước 5: ..."],
     "targetGoals":["Mục tiêu 1","Mục tiêu 2","Mục tiêu 3"]}
  ],
  "clinicalNote": "Lưu ý lâm sàng ngắn"
}`;

  const fallback: ReportContent = {
    videoObservations: [
      { label: "Bối cảnh", value: video.context ?? video.location ?? "Không rõ" },
      { label: "Hành vi quan sát", value: frameAnalysis.tags.join(", ") },
    ],
    behaviourAnalysis: frameAnalysis.summary,
    interventionStrategy: `Áp dụng kết hợp ${fullAnalysis.interventionPlan.approach.join(", ")} dựa trên hành vi quan sát.`,
    monthlyPlan: [
      { period: "Tuần 1–2", focus: "Thiết lập thói quen", activities: ["Thực hành bài tập hàng ngày", "Ghi chép quan sát"] },
      { period: "Tuần 3–4", focus: "Củng cố kỹ năng", activities: ["Nâng cao độ phức tạp", "Đánh giá tiến trình"] },
    ],
    exercises: fullAnalysis.interventionPlan.lessons.slice(0, 5).map((l, i) => ({
      number: i + 1, title: l.title,
      basedOn: l.rationale ?? "Dựa trên hành vi quan sát trong video",
      therapies: fullAnalysis.interventionPlan.approach,
      objective: l.checklist[0]?.description ?? "Cải thiện kỹ năng",
      steps: l.steps.map((s) => `${s.title}: ${s.description}`),
      targetGoals: l.checklist.map((c) => c.description),
    })),
    clinicalNote: frameAnalysis.suggestedNote,
  };

  // Primary: Gemini
  try {
    const raw = await callGeminiText(REPORT_SYSTEM, prompt);
    return extractJson<ReportContent>(raw);
  } catch (geminiErr: any) {
    const gMsg = geminiErr?.message || String(geminiErr);
    console.warn("[Phase3] Gemini failed:", gMsg);
    
    if (gMsg.includes("429") || gMsg.includes("quota")) {
      return fallback;
    }

    try {
      const raw = await callClaudeText(REPORT_SYSTEM, prompt, 5000);
      return extractJson<ReportContent>(raw);
    } catch (err) {
      console.error("[Phase3] Both failed:", err);
      return fallback;
    }
  }
}
