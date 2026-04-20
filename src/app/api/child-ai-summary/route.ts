import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface AiSummaryCard {
  label: string;
  value: string;
  sub: string;
  color: "indigo" | "emerald" | "purple" | "amber";
}

export interface AiSummary {
  headline: string;
  overallTrend: "improving" | "stable" | "declining";
  keyCards: AiSummaryCard[];
  parentMessage: string;
  nextSteps: string[];
}

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("childId");
  if (!childId) return NextResponse.json({ error: "childId required" }, { status: 400 });

  try {
    const db = getAdminDb();

    const snap = await db.collection("video_analysis").where("childId", "==", childId).get();
    const count = snap.size;
    if (count === 0) return NextResponse.json({ summary: null });

    // Return cache if analysis count unchanged
    const cacheRef = db.collection("child_ai_summary").doc(childId);
    const cache = await cacheRef.get();
    if (cache.exists && cache.data()?.analysisCount === count) {
      return NextResponse.json({ summary: cache.data()?.summary as AiSummary });
    }

    // Compact data for Gemini
    const analyses = snap.docs
      .map((d) => {
        const a = d.data();
        return {
          date: a.createdAt?.toDate?.()?.toISOString?.()?.split("T")[0] ?? "?",
          hpdt: a.frameAnalysis?.hpdt ?? {},
          regulation: a.summary?.regulationLevel ?? "transitioning",
          dominantBehavior: a.summary?.dominantBehavior ?? "",
          keyInsights: ((a.summary?.keyInsights ?? []) as string[]).slice(0, 2),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const childSnap = await db.collection("children").doc(childId).get();
    const childName = childSnap.exists ? (childSnap.data()?.name ?? "bé") : "bé";

    const key = process.env.GOOGLE_GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GOOGLE_GEMINI_API_KEY missing");

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Bạn là AI hỗ trợ can thiệp tự kỷ. Tổng hợp tiến trình của bé ${childName} dựa trên ${count} lần phân tích video.

Dữ liệu (sắp xếp theo thời gian):
${JSON.stringify(analyses, null, 2)}

Viết cho PHỤ HUYNH — ấm áp, đơn giản, không thuật ngữ chuyên môn. Tập trung vào tiến bộ tích cực.

Output JSON thuần, không markdown:
{
  "headline": "1 câu mô tả ngắn tiến trình gần nhất, ấm áp",
  "overallTrend": "improving|stable|declining",
  "keyCards": [
    {"label": "Tiến độ HPDT", "value": "ví dụ: +12 điểm", "sub": "so với lần đầu", "color": "indigo"},
    {"label": "Điều hòa cảm xúc", "value": "ví dụ: Tốt dần", "sub": "X/Y buổi ổn định", "color": "emerald"},
    {"label": "Điểm mạnh", "value": "lĩnh vực tiến bộ nhất", "sub": "mô tả ngắn", "color": "purple"},
    {"label": "Cần tập trung", "value": "lĩnh vực cần hỗ trợ", "sub": "gợi ý ngắn", "color": "amber"}
  ],
  "parentMessage": "2-3 câu nhắn nhủ ấm áp, cụ thể dựa trên dữ liệu thực",
  "nextSteps": ["Gợi ý thực hành cụ thể 1", "Gợi ý thực hành cụ thể 2", "Gợi ý thực hành cụ thể 3"]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    let s = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    s = s.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
    const summary: AiSummary = JSON.parse(s);

    await cacheRef.set({ analysisCount: count, summary, updatedAt: new Date().toISOString() });

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[child-ai-summary]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
