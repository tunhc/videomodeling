import { NextResponse } from "next/server";
import * as mammoth from "mammoth";
import { getGeminiResponse } from "@/lib/gemini";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// Danh sách các bài tập mẫu cần quét
const EXERCISE_KEYWORDS = [
  "hộp bình tĩnh",
  "bàn tay thám tử",
  "rửa tay 6 bước",
  "khoanh tay xin",
  "chờ tới lượt",
  "giao tiếp mắt",
  "trỏ ngón",
  "chơi luân phiên"
];

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractPayloadFromWordFile(file: File) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".doc")) {
    throw new Error("Định dạng .doc chưa được hỗ trợ. Vui lòng chuyển sang .docx.");
  }

  if (lowerName.endsWith(".txt") || file.type.startsWith("text/")) {
    const text = await file.text();
    return { htmlContent: normalizeExtractedText(text), textContent: text, isHtml: false };
  }

  if (
    !lowerName.endsWith(".docx") &&
    file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    throw new Error("Chỉ hỗ trợ file .docx hoặc .txt ở phiên bản hiện tại.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Extract Raw text for simple keyword matching
  const rawResult = await mammoth.extractRawText({ buffer });
  const textContent = normalizeExtractedText(rawResult.value || "");

  // Convert to HTML for Gemini to understand tables and layout structurally
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const htmlContent = htmlResult.value || "";

  return { htmlContent, textContent, isHtml: true };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file upload." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "File rỗng, không thể xử lý." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File vượt quá 15MB. Vui lòng tách nhỏ tài liệu." },
        { status: 413 }
      );
    }

    const { htmlContent, textContent } = await extractPayloadFromWordFile(file);

    if (!textContent) {
      return NextResponse.json(
        { error: "Không đọc được nội dung văn bản từ file này." },
        { status: 422 }
      );
    }

    const lowerText = textContent.toLowerCase();
    const foundExercises: string[] = [];

    // Simple keyword matching for exercises
    for (const keyword of EXERCISE_KEYWORDS) {
      if (lowerText.includes(keyword)) {
        foundExercises.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    }

    // Call Gemini with docx-parse skill to analyze HTML tables and behaviors
    let behaviors = [];
    try {
      const geminiPrompt = `Hãy phân tích nội dung sau và xuất mảng JSON chứa các hành vi:\n\n${htmlContent}`;
      const geminiResponseText = await getGeminiResponse(geminiPrompt, null, "docx-parse");
      
      // Attempt to clean JSON: remove potential markdown blocks if AI ignored instructions
      let cleanJson = geminiResponseText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const parsedJson = JSON.parse(cleanJson);
      if (Array.isArray(parsedJson)) {
        behaviors = parsedJson;
      }
    } catch (genError) {
      console.error("Lỗi khi parse DOCX bằng Gemini:", genError);
      // Fail gracefully: continue with just the basic keyword exercises
    }

    return NextResponse.json({
      success: true,
      foundExercises,
      behaviors,
      characterCount: textContent.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xác định";
    return NextResponse.json(
      { error: `Upload/đọc file Word thất bại: ${message}` },
      { status: 500 }
    );
  }
}
