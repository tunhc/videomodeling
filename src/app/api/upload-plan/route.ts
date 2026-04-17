import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { getAdminDb, getAdminStorage } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

async function extractHtml(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.convertToHtml({ buffer });
    return result.value || "";
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const childId = formData.get("childId") as string | null;
    const uploaderId = formData.get("uploaderId") as string | null;
    const uploaderName = formData.get("uploaderName") as string | null;

    if (!file || !childId) {
      return NextResponse.json({ error: "file and childId are required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File quá lớn (tối đa 5 MB)" }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Extract HTML content from Word file for in-app preview
    const contentHtml = await extractHtml(buffer);

    let downloadURL: string;
    let storageMethod: "firebase" | "firestore";

    // Try Firebase Admin Storage first
    try {
      const adminStorage = getAdminStorage();
      const bucket = adminStorage.bucket();
      const filePath = `intervention_plans/${childId}/${timestamp}_${safeName}`;
      const fileRef = bucket.file(filePath);

      await fileRef.save(buffer, {
        metadata: {
          contentType: file.type || "application/octet-stream",
          metadata: { childId, uploaderId: uploaderId || "unknown" },
        },
      });

      const [signedUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "01-01-2035",
      });

      downloadURL = signedUrl;
      storageMethod = "firebase";
    } catch {
      if (buffer.length > 750 * 1024) {
        return NextResponse.json(
          { error: "Firebase Storage chưa được cấu hình và file > 750 KB." },
          { status: 503 }
        );
      }
      const base64 = buffer.toString("base64");
      downloadURL = `data:${file.type || "application/octet-stream"};base64,${base64}`;
      storageMethod = "firestore";
    }

    // Save to Firestore including extracted HTML
    const db = getAdminDb();
    const docRef = db.collection("intervention_plans").doc();
    await docRef.set({
      id: docRef.id,
      childId,
      name: file.name,
      url: downloadURL,
      contentHtml,
      storageMethod,
      uploadedAt: new Date(),
      uploaderId: uploaderId || "unknown",
      uploaderName: uploaderName || "Chuyên gia",
    });

    return NextResponse.json({ id: docRef.id, url: downloadURL, name: file.name });
  } catch (err) {
    console.error("[upload-plan] Error:", err);
    return NextResponse.json(
      { error: "Upload thất bại", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
