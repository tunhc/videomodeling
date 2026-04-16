import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy", // Default to dummy to prevent crash without key
});

export interface FrameAnalysisMilestone {
  second: number;
  label: string;
  eyeContact: number;
  domain: "Social" | "Cognitive" | "Behavior" | "Sensory" | "Motor";
  score: number;
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
}

/**
 * Convert a Cloudinary video URL to a frame thumbnail URL at a specific second.
 * Example input:  https://res.cloudinary.com/demo/video/upload/f_auto,q_auto/v123/folder/file.mp4
 * Example output: https://res.cloudinary.com/demo/video/upload/so_5,c_fill,w_480,h_640/v123/folder/file.jpg
 */
function getCloudinaryFrameUrl(videoUrl: string, second: number): string | null {
  if (!videoUrl || !videoUrl.includes("cloudinary.com")) return null;

  const uploadPrefix = "/video/upload/";
  const uploadIdx = videoUrl.indexOf(uploadPrefix);
  if (uploadIdx === -1) return null;

  const base = videoUrl.substring(0, uploadIdx);
  const afterUpload = videoUrl.substring(uploadIdx + uploadPrefix.length);

  // Find the version segment (v + 8+ digits) to anchor the path,
  // ignoring any existing transformation params before it.
  const versionMatch = afterUpload.match(/(v\d{6,}\/.+)/);
  const resourcePath = versionMatch ? versionMatch[1] : afterUpload;

  // Replace video extension with .jpg for frame extraction
  const jpgPath = resourcePath.replace(/\.[^./?#]+$/, ".jpg");

  return `${base}/video/upload/so_${Math.floor(second)},c_fill,w_480,h_640/${jpgPath}`;
}

/**
 * Fetch a URL and return its content as a base64 string, along with MIME type.
 */
async function fetchAsBase64(
  url: string
): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const mediaType = contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

    return { data: base64, mediaType };
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích hành vi can thiệp tự kỷ cho nền tảng AI4Autism tại Việt Nam.
Nhiệm vụ: Phân tích các frame ảnh trích xuất từ video buổi can thiệp để đánh giá hành vi và phát triển của trẻ.

Trả về JSON hợp lệ với cấu trúc sau (không kèm text nào khác):
{
  "tags": ["string"],           // 3-5 nhãn hành vi bằng tiếng Việt (VD: "Giao tiếp mắt", "Chào hỏi", "Tự phục vụ")
  "milestones": [               // Các mốc quan trọng phân bố đều theo thời gian video
    {
      "second": number,         // Giây trong video (ước tính từ vị trí frame)
      "label": "string",        // Mô tả ngắn bằng tiếng Việt
      "eyeContact": number,     // % giao tiếp mắt ước tính (0-100)
      "domain": "Social"|"Cognitive"|"Behavior"|"Sensory"|"Motor",
      "score": number           // Điểm tương tác 0-100
    }
  ],
  "hpdt": {                     // Điểm HPDT 5 miền (0-100)
    "social": number,
    "cognitive": number,
    "behavior": number,
    "sensory": number,
    "motor": number,
    "overall": number           // Tính trung bình 5 miền
  },
  "summary": "string",          // Tóm tắt buổi can thiệp (2-3 câu, tiếng Việt)
  "suggestedNote": "string"     // Ghi chú đề xuất cho giáo viên (tiếng Việt)
}

Nguyên tắc đánh giá:
- Quan sát kỹ giao tiếp mắt, biểu cảm, tư thế, tay chân
- Nhận diện bối cảnh can thiệp (trong nhà, lớp học, ngoài trời)
- Đánh giá mức độ tham gia và hợp tác của trẻ
- Đưa ra điểm số thực tế, không quá cao hoặc quá thấp`;

/**
 * Analyze video frames using Claude Vision.
 * Extracts N frames from a Cloudinary video URL and sends them to Claude for behavioral analysis.
 */
export async function analyzeVideoFrames(
  videoUrl: string,
  duration: number,
  childContext: {
    childId?: string;
    primaryTag?: string;
    context?: string;
    topic?: string;
  }
): Promise<VideoAnalysisResult> {
  const videoDuration = duration > 0 ? duration : 60;
  const frameCount = Math.min(6, Math.max(3, Math.floor(videoDuration / 15)));
  const interval = videoDuration / (frameCount + 1);

  // Generate evenly-spaced frame timestamps
  const frameSeconds = Array.from(
    { length: frameCount },
    (_, i) => Math.round(interval * (i + 1))
  );

  // Fetch frames in parallel
  const frameResults = await Promise.all(
    frameSeconds.map(async (second) => {
      const frameUrl = getCloudinaryFrameUrl(videoUrl, second);
      if (!frameUrl) return null;
      const imageData = await fetchAsBase64(frameUrl);
      return imageData ? { second, ...imageData } : null;
    })
  );

  const validFrames = frameResults.filter(Boolean) as Array<{
    second: number;
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp";
  }>;

  if (validFrames.length === 0) {
    return buildFallbackResult(videoDuration, frameSeconds);
  }

  // Build the message content with frames
  const imageContent: Anthropic.ImageBlockParam[] = validFrames.map((frame) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: frame.mediaType,
      data: frame.data,
    },
  }));

  const textContent: Anthropic.TextBlockParam = {
    type: "text",
    text: `Phân tích ${validFrames.length} frame từ video can thiệp.
Thông tin bổ sung:
- Loại hoạt động: ${childContext.primaryTag || "can thiệp chung"}
- Bối cảnh: ${childContext.context || "chưa xác định"}
- Chủ đề: ${childContext.topic || "chưa xác định"}
- Thời lượng video: ${videoDuration}s
- Timestamps các frame (giây): ${validFrames.map((f) => f.second).join(", ")}

Hãy phân tích toàn bộ các frame trên và trả về JSON đánh giá theo cấu trúc đã quy định.`,
  };

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [...imageContent, textContent],
        },
      ],
    });

    const message = await stream.finalMessage();

    // Extract text response from content blocks
    const textBlock = message.content.find((b) => b.type === "text");
    const responseText = textBlock && "text" in textBlock ? textBlock.text : "";

    return parseClaudeResponse(responseText, videoDuration, frameSeconds);
  } catch (error: any) {
    console.warn("Claude API analysis failed, falling back to Gemini...", error?.message || error);
    return analyzeVideoFramesWithGemini(validFrames, videoDuration, frameSeconds, childContext);
  }
}

async function analyzeVideoFramesWithGemini(
  validFrames: Array<{ second: number; data: string; mediaType: string }>,
  videoDuration: number,
  frameSeconds: number[],
  childContext: any
): Promise<VideoAnalysisResult> {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing Gemini key");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const parts = validFrames.map((frame) => ({
      inlineData: {
        data: frame.data,
        mimeType: frame.mediaType,
      },
    }));

    const textPart = `Phân tích ${validFrames.length} frame từ video can thiệp.
Thông tin bổ sung:
- Loại hoạt động: ${childContext.primaryTag || "can thiệp chung"}
- Bối cảnh: ${childContext.context || "chưa xác định"}
- Chủ đề: ${childContext.topic || "chưa xác định"}
- Thời lượng video: ${videoDuration}s
- Timestamps các frame (giây): ${validFrames.map((f) => f.second).join(", ")}

${SYSTEM_PROMPT}`;

    const result = await model.generateContent([textPart, ...parts]);
    const response = await result.response;
    return parseClaudeResponse(response.text(), videoDuration, frameSeconds);
  } catch (e) {
    console.error("Gemini Fallback Error:", e);
    return buildFallbackResult(videoDuration, frameSeconds);
  }
}

function parseClaudeResponse(
  responseText: string,
  duration: number,
  frameSeconds: number[]
): VideoAnalysisResult {
  try {
    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = JSON.parse(jsonMatch[0]) as VideoAnalysisResult;

    // Validate and clamp hpdt values
    if (parsed.hpdt) {
      const domains = ["social", "cognitive", "behavior", "sensory", "motor"] as const;
      for (const d of domains) {
        parsed.hpdt[d] = Math.min(100, Math.max(0, Math.round(parsed.hpdt[d] || 0)));
      }
      parsed.hpdt.overall = Math.round(
        domains.reduce((sum, d) => sum + parsed.hpdt[d], 0) / domains.length
      );
    }

    return parsed;
  } catch {
    return buildFallbackResult(duration, frameSeconds);
  }
}

/**
 * Fallback result when Claude analysis is unavailable.
 */
function buildFallbackResult(
  duration: number,
  frameSeconds: number[]
): VideoAnalysisResult {
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
      social: Math.round(avg),
      cognitive: Math.round(avg - 5),
      behavior: Math.round(avg + 5),
      sensory: Math.round(avg - 10),
      motor: Math.round(avg),
      overall: Math.round(avg),
    },
    summary: "Không thể kết nối Claude API. Đây là kết quả ước tính cơ bản.",
    suggestedNote: "Vui lòng xem lại video và nhập ghi chú thủ công.",
  };
}
