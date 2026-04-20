import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import type { ReportContent, ReportExercise, ReportMonthlyPlan } from "@/lib/claude";

export const runtime = "nodejs";

// Màu liệu pháp
const THERAPY_COLORS: Record<string, string> = {
  ABA: "#1d4ed8", DIR: "#7c3aed", OT: "#059669",
  VM: "#b45309", "Ngôn ngữ": "#0891b2", NMT: "#db2777",
  PECS: "#9333ea", "Floortime": "#4f46e5",
};
function therapyBadge(t: string): string {
  const color = THERAPY_COLORS[t] ?? "#374151";
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;margin-right:4px;letter-spacing:0.5px;">${t}</span>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function exerciseHtml(ex: ReportExercise): string {
  const badges = ex.therapies.map(therapyBadge).join("");
  const steps  = ex.steps.map((s, i) => `<li style="margin-bottom:6px;">${escHtml(s.replace(/^Bước \d+:\s*/i, ""))}</li>`).join("");
  const goals  = ex.targetGoals.map((g) => `<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:10px;font-weight:700;padding:2px 10px;border-radius:12px;margin:2px 4px 2px 0;">${escHtml(g)}</span>`).join("");

  return `
  <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-left:4px solid #1d4ed8;border-radius:0 12px 12px 0;padding:0;overflow:hidden;page-break-inside:avoid;">
    <div style="background:#f0f7ff;padding:14px 18px 10px;">
      <div style="font-size:14px;font-weight:800;color:#1e3a5f;margin-bottom:4px;">Bài ${ex.number} &nbsp; ${escHtml(ex.title)}</div>
      <div style="font-size:11px;color:#64748b;font-style:italic;margin-bottom:6px;">${escHtml(ex.basedOn)}</div>
      <div>${badges}</div>
    </div>
    <div style="padding:14px 18px;">
      <div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;margin-bottom:4px;">Mục tiêu</div>
      <div style="font-size:12px;color:#374151;font-style:italic;margin-bottom:12px;">${escHtml(ex.objective)}</div>
      <div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;margin-bottom:6px;">Cách thực hiện</div>
      <ol style="margin:0;padding-left:20px;font-size:12px;color:#374151;line-height:1.7;">${steps}</ol>
      ${ex.targetGoals.length > 0 ? `
      <div style="margin-top:12px;padding-top:10px;border-top:1px dashed #e2e8f0;">
        <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Mục tiêu hướng đến: </span>${goals}
      </div>` : ""}
    </div>
  </div>`;
}

function monthlyPlanHtml(plan: ReportMonthlyPlan[]): string {
  const rows = plan.map((p) => `
    <tr>
      <td style="padding:10px 14px;font-weight:700;font-size:12px;color:#1e3a5f;white-space:nowrap;border-bottom:1px solid #e2e8f0;background:#f8fafc;">${escHtml(p.period)}</td>
      <td style="padding:10px 14px;font-size:12px;color:#374151;font-style:italic;border-bottom:1px solid #e2e8f0;">${escHtml(p.focus)}</td>
      <td style="padding:10px 14px;font-size:11px;color:#374151;border-bottom:1px solid #e2e8f0;">
        <ul style="margin:0;padding-left:16px;">${p.activities.map((a) => `<li style="margin-bottom:3px;">${escHtml(a)}</li>`).join("")}</ul>
      </td>
    </tr>`).join("");
  return `
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;">
    <thead>
      <tr style="background:#1e3a5f;color:#fff;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Giai đoạn</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Trọng tâm</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Hoạt động</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export async function GET(request: NextRequest) {
  const analysisId = request.nextUrl.searchParams.get("analysisId");
  if (!analysisId) {
    return NextResponse.json({ error: "analysisId required" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection("video_analysis").doc(analysisId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const data = snap.data()!;
    const report = data.reportContent as ReportContent | undefined;
    const childId = data.childId as string;
    const videoId = data.videoId as string;

    // Fetch child + video metadata in parallel
    const [childSnap, videoSnap] = await Promise.all([
      db.collection("children").doc(childId).get(),
      db.collection("video_modeling").doc(videoId).get(),
    ]);

    const child = childSnap.data() ?? {};
    const video = videoSnap.data() ?? {};
    const childName = (child.name as string | undefined) ?? childId;

    const recordDate  = data.createdAt?.toDate
      ? (data.createdAt.toDate() as Date).toLocaleDateString("vi-VN")
      : new Date(data.createdAt).toLocaleDateString("vi-VN");
    const context    = (video.context ?? video.location ?? "Không rõ") as string;
    const duration   = video.duration ? `~${video.duration} giây` : "Không rõ";
    const publicId   = (video.publicId ?? videoId) as string;

    // Observation rows
    const obsRows = (report?.videoObservations ?? [])
      .map((row) => `
        <tr>
          <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;width:180px;white-space:nowrap;">${escHtml(row.label)}</td>
          <td style="padding:8px 12px;font-size:12px;color:#374151;border:1px solid #e2e8f0;">${escHtml(row.value)}</td>
        </tr>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Báo cáo can thiệp — ${escHtml(childName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      max-width: 860px;
      margin: 0 auto;
      padding: 32px 40px;
      color: #1a1a2e;
      line-height: 1.6;
      font-size: 13px;
    }
    @media print {
      body { padding: 20px 28px; }
      .no-print { display: none !important; }
      a { text-decoration: none; }
    }
    h1 { font-size: 28px; font-weight: 900; color: #1e3a5f; margin: 0 0 4px; letter-spacing: -0.5px; }
    h2 { font-size: 18px; font-weight: 800; color: #1e3a5f; margin: 28px 0 12px; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; }
    h3 { font-size: 13px; font-weight: 800; color: #1e3a5f; margin: 16px 0 6px; }
    p  { margin: 0 0 10px; }
    .subtitle { font-style: italic; color: #64748b; font-size: 14px; margin-bottom: 20px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; }
    .info-table th { background: #1e3a5f; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 14px; text-align: left; }
    .info-table td { background: #f0f7ff; font-size: 13px; font-weight: 700; color: #1e3a5f; padding: 10px 14px; border-right: 1px solid #bfdbfe; }
    .section-text { font-size: 13px; color: #374151; margin-bottom: 14px; line-height: 1.75; }
    .strategy-box { background: #f0f7ff; border-left: 4px solid #1d4ed8; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px; }
    .clinical-note { background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 14px 18px; font-style: italic; color: #713f12; font-size: 12px; margin-top: 28px; }
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: #1d4ed8; color: #fff; border: none; padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(29,78,216,0.3); }
    .print-btn:hover { background: #1e40af; }
    .page-num { text-align: right; font-size: 10px; color: #94a3b8; margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>

  <!-- Print button (hidden on print) -->
  <button class="print-btn no-print" onclick="window.print()">🖨 In / Lưu PDF</button>

  <!-- Logos row -->
  <div style="display:flex;align-items:center;gap:24px;margin-bottom:20px;">
    <div style="width:52px;height:52px;background:#1e3a5f;border-radius:12px;display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:16px;font-weight:900;">NBAI</span>
    </div>
    <div style="width:52px;height:52px;background:#1d4ed8;border-radius:12px;display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:9px;font-weight:900;text-align:center;line-height:1.2;">AI4<br/>AUTISM</span>
    </div>
    <div style="width:52px;height:52px;background:#059669;border-radius:12px;display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:8px;font-weight:900;text-align:center;line-height:1.3;">JOB<br/>FOR<br/>AUTISM</span>
    </div>
  </div>

  <!-- Title -->
  <h1>BÁO CÁO CAN THIỆP ĐA LIỆU PHÁP</h1>
  <p class="subtitle">Trẻ tự kỷ — Can thiệp ${escHtml(context)}</p>

  <!-- Info table -->
  <table class="info-table">
    <thead>
      <tr>
        <th>Họ và tên</th>
        <th>Ngày phân tích</th>
        <th>Bối cảnh</th>
        <th>Thời lượng</th>
        <th>Mã video</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${escHtml(childName)}</td>
        <td>${escHtml(recordDate)}</td>
        <td>${escHtml(context)}</td>
        <td>${escHtml(duration)}</td>
        <td style="font-size:10px;word-break:break-all;">${escHtml(publicId)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Section I: Observations -->
  <h2>I. Quan Sát Hành Vi Từ Video</h2>
  <p class="section-text">Video dài ${escHtml(duration)} ghi lại sinh hoạt của bé tại ${escHtml(context)}. Các hành vi sau đây được ghi nhận:</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tbody>${obsRows}</tbody>
  </table>

  <!-- Behaviour analysis -->
  ${report?.behaviourAnalysis ? `<h3>Phân tích hành vi</h3><p class="section-text">${escHtml(report.behaviourAnalysis).replace(/\n/g, "<br/>")}</p>` : ""}

  <!-- Section II: Intervention -->
  <h2>II. Chiến Lược & Bài Tập Can Thiệp Đa Liệu Pháp</h2>

  ${report?.interventionStrategy ? `
  <h3>Chiến lược can thiệp</h3>
  <div class="strategy-box">
    <p style="margin:0;font-size:12px;color:#1e3a5f;">${escHtml(report.interventionStrategy).replace(/\n/g, "<br/>")}</p>
  </div>` : ""}

  ${report?.monthlyPlan?.length ? `
  <h3>Kế hoạch 1 tháng</h3>
  ${monthlyPlanHtml(report.monthlyPlan)}
  <div style="margin-bottom:24px;"></div>` : ""}

  <h3>Bài tập cụ thể</h3>
  <p class="section-text" style="margin-bottom:16px;">Mỗi bài tập được thiết kế dựa trên hành vi quan sát thực tế, kết hợp đa liệu pháp để tối ưu hóa hiệu quả can thiệp tại nhà.</p>
  ${(report?.exercises ?? []).map(exerciseHtml).join("")}

  <!-- Clinical note -->
  ${report?.clinicalNote ? `
  <div class="clinical-note">
    <strong style="font-size:12px;">Lưu ý lâm sàng</strong><br/>
    ${escHtml(report.clinicalNote)}
  </div>` : ""}

  <div class="page-num">Báo cáo được tạo tự động bởi AI4Autism · ${escHtml(recordDate)}</div>

</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[generate-report]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
