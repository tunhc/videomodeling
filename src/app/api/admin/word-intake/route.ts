import { NextResponse } from "next/server";
import * as mammoth from "mammoth";
import { getAdminDb } from "@/lib/firebase-admin";
import { buildWordInsightsFromText } from "@/lib/word-insights";
import { isAdminId } from "@/lib/constants";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

function isAdminUser(userId: string) {
  return isAdminId(userId);
}

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractTextFromWordFile(file: File) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".doc")) {
    throw new Error("Định dạng .doc chưa được hỗ trợ. Vui lòng chuyển sang .docx.");
  }

  if (lowerName.endsWith(".txt") || file.type.startsWith("text/")) {
    return {
      text: normalizeExtractedText(await file.text()),
      warnings: [] as string[],
    };
  }

  if (
    !lowerName.endsWith(".docx") &&
    file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    throw new Error("Chỉ hỗ trợ file .docx hoặc .txt ở phiên bản hiện tại.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(arrayBuffer),
  });

  return {
    text: normalizeExtractedText(result.value || ""),
    warnings: result.messages.map((message) => message.message),
  };
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

type PersistBasePayload = {
  childId: string;
  childName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  extractedText: string;
  preview: string;
  wordCount: number;
  characterCount: number;
  insights: ReturnType<typeof buildWordInsightsFromText>;
  parseWarnings: string[];
  uploadedBy: string;
  uploadedByRole: string;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const childId = String(formData.get("childId") || "").trim();
    const childName = String(formData.get("childName") || "").trim();
    const uploadedBy = String(formData.get("uploadedBy") || "").trim();
    const uploadedByRole = String(formData.get("uploadedByRole") || "").trim();
    const file = formData.get("file");

    if (uploadedByRole !== "admin" || !isAdminUser(uploadedBy)) {
      return NextResponse.json(
        { error: "Chỉ quản trị viên mới được nạp hồ sơ Word." },
        { status: 403 }
      );
    }

    if (!childId) {
      return NextResponse.json({ error: "Thiếu mã bé (childId)." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file upload." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "File rỗng, không thể xử lý." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            "File vượt quá 15MB. Vui lòng tách nhỏ tài liệu hoặc nén lại trước khi tải lên.",
        },
        { status: 413 }
      );
    }

    const extracted = await extractTextFromWordFile(file);

    if (!extracted.text) {
      return NextResponse.json(
        {
          error: "Không đọc được nội dung văn bản từ file này.",
        },
        { status: 422 }
      );
    }

    const now = new Date();
    const preview = extracted.text.slice(0, 1200);
    const wordCount = countWords(extracted.text);
    const generatedInsights = buildWordInsightsFromText(extracted.text);

    const basePayload: PersistBasePayload = {
      childId,
      childName,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      extractedText: extracted.text,
      preview,
      wordCount,
      characterCount: extracted.text.length,
      insights: generatedInsights,
      parseWarnings: extracted.warnings,
      uploadedBy,
      uploadedByRole,
    };

    let adminDb: ReturnType<typeof getAdminDb> | null = null;
    try {
      adminDb = getAdminDb();
    } catch {
      adminDb = null;
    }

    if (!adminDb) {
      return NextResponse.json({
        ...basePayload,
        persisted: false,
        requiresClientPersist: true,
        createdAt: now.toISOString(),
      });
    }

    const allChildDocsSnap = await adminDb
      .collection("child_documents")
      .where("childId", "==", childId)
      .get();

    const nextVersion =
      allChildDocsSnap.docs.filter((docSnap) => {
        const data = docSnap.data();
        return typeof data.fileName === "string" && data.fileName === file.name;
      }).length + 1;

    const documentPayload = {
      childId: basePayload.childId,
      childName: basePayload.childName,
      sourceType: "word_upload",
      fileName: basePayload.fileName,
      mimeType: basePayload.mimeType,
      fileSize: basePayload.fileSize,
      version: nextVersion,
      extractedText: basePayload.extractedText,
      preview: basePayload.preview,
      wordCount: basePayload.wordCount,
      characterCount: basePayload.characterCount,
      analysis: generatedInsights,
      parseWarnings: basePayload.parseWarnings,
      status: "parsed",
      uploadedBy: basePayload.uploadedBy,
      uploadedByRole: basePayload.uploadedByRole,
      createdAt: now,
      updatedAt: now,
    };

    const newDocRef = await adminDb.collection("child_documents").add(documentPayload);

    const latestWordDoc = {
      docId: newDocRef.id,
      fileName: file.name,
      version: nextVersion,
      uploadedAt: now,
      wordCount,
      preview,
    };

    const latestWordInsights = {
      sourceDocId: newDocRef.id,
      fileName: file.name,
      updatedAt: now,
      ...generatedInsights,
    };

    const childRef = adminDb.collection("children").doc(childId);
    const childSnap = await childRef.get();

    if (childSnap.exists) {
      await childRef.set(
        {
          latestWordDoc,
          latestWordInsights,
          updatedAt: now,
        },
        { merge: true }
      );
    } else {
      const studentRef = adminDb.collection("students").doc(childId);
      const studentSnap = await studentRef.get();
      if (studentSnap.exists) {
        await studentRef.set(
          {
            latestWordDoc,
            latestWordInsights,
            updatedAt: now,
          },
          { merge: true }
        );
      }
    }

    await adminDb
      .collection("hpdt_stats")
      .doc(childId)
      .set(
        {
          childId,
          latestWordInsights,
          lastWordDocAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    return NextResponse.json({
      documentId: newDocRef.id,
      childId,
      fileName: file.name,
      version: nextVersion,
      wordCount,
      characterCount: extracted.text.length,
      preview,
      insights: latestWordInsights,
      parseWarnings: extracted.warnings,
      persisted: true,
      createdAt: now.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xác định";
    return NextResponse.json(
      { error: `Upload/đọc file Word thất bại: ${message}` },
      { status: 500 }
    );
  }
}