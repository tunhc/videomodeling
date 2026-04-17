import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const db = getAdminDb();
    const snap = await db.collection("intervention_plans").doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = snap.data() as { contentHtml?: string; name?: string };
    const html = data.contentHtml || "<p><em>Không có nội dung để hiển thị.</em></p>";

    const page = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${data.name || "Bài học can thiệp"}</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; max-width: 860px; margin: 0 auto; padding: 2rem 2.5rem; color: #1a1a2e; line-height: 1.7; }
    h1,h2,h3 { color: #1d3557; margin-top: 1.5em; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    td, th { border: 1px solid #cbd5e1; padding: 0.5em 0.75em; }
    th { background: #e0e7ff; font-weight: 600; }
    p { margin: 0.6em 0; }
    ul, ol { padding-left: 1.5em; }
    @media print { body { padding: 1rem; } }
  </style>
</head>
<body>${html}</body>
</html>`;

    return new NextResponse(page, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[view-plan] Error:", err);
    return NextResponse.json({ error: "Không thể tải nội dung" }, { status: 500 });
  }
}
