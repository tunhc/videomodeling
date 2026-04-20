import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
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
    const snap = await getDoc(doc(db, "video_analysis", analysisId));
    if (!snap.exists()) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const data = snap.data()!;
    const report = data.reportContent as ReportContent | undefined;
    const childId = data.childId as string;
    const videoId = data.videoId as string;
    const summary = data.summary ?? {};
    const plan    = data.interventionPlan ?? {};
    const frame   = data.frameAnalysis ?? {};

    // Fetch child + video metadata in parallel
    const [childSnap, videoSnap] = await Promise.all([
      getDoc(doc(db, "children", childId)),
      getDoc(doc(db, "video_modeling", videoId)),
    ]);

    const child = childSnap.data() ?? {};
    const video = videoSnap.data() ?? {};
    const childName = (child.name as string | undefined) ?? childId;

    const recordDate = (() => {
      try {
        const ts = data.createdAt;
        if (ts && typeof ts.toDate === "function") return ts.toDate().toLocaleDateString("vi-VN");
        if (ts) return new Date(ts).toLocaleDateString("vi-VN");
      } catch {}
      return new Date().toLocaleDateString("vi-VN");
    })();
    const context  = (video.context ?? video.location ?? "Không rõ") as string;
    const duration = video.duration ? `~${video.duration} giây` : "Không rõ";
    const publicId = (video.publicId ?? videoId) as string;

    // ── Section I content ──────────────────────────────────────────────────────
    // Prefer reportContent.videoObservations, else build from frameAnalysis tags + summary
    const obsRows = (() => {
      if (report?.videoObservations?.length) {
        return report.videoObservations
          .map((row: any) => `
            <tr>
              <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;width:180px;white-space:nowrap;">${escHtml(row.label)}</td>
              <td style="padding:8px 12px;font-size:12px;color:#374151;border:1px solid #e2e8f0;">${escHtml(row.value)}</td>
            </tr>`)
          .join("");
      }
      // Fallback from frameAnalysis
      const rows: { label: string; value: string }[] = [];
      if (summary.dominantBehavior) rows.push({ label: "Hành vi nổi bật", value: summary.dominantBehavior });
      if (summary.regulationLevel)  rows.push({ label: "Mức điều hòa",    value: summary.regulationLevel === "regulated" ? "Điều hòa tốt" : summary.regulationLevel === "transitioning" ? "Đang chuyển tiếp" : "Mất điều hòa" });
      if ((frame.tags ?? []).length) rows.push({ label: "Nhãn hành vi",   value: (frame.tags as string[]).join(", ") });
      if (frame.hpdt?.overall)       rows.push({ label: "Điểm HPDT",      value: `${frame.hpdt.overall}/100` });
      return rows.map((r) => `
        <tr>
          <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;width:180px;white-space:nowrap;">${escHtml(r.label)}</td>
          <td style="padding:8px 12px;font-size:12px;color:#374151;border:1px solid #e2e8f0;">${escHtml(r.value)}</td>
        </tr>`).join("");
    })();

    const behaviourText = report?.behaviourAnalysis
      || [summary.overallRecommendation, ...(summary.keyInsights ?? [])].filter(Boolean).join("\n\n")
      || "";

    // ── Section II content ─────────────────────────────────────────────────────
    const strategyText = report?.interventionStrategy
      || ((plan.approach ?? []) as string[]).join(" · ")
      || "";

    // Exercises: prefer reportContent, else build simple cards from lessons
    const exerciseBlocks = (() => {
      if (report?.exercises?.length) return (report.exercises as ReportExercise[]).map(exerciseHtml).join("");
      const lessons: any[] = plan.lessons ?? [];
      if (!lessons.length) return `<p class="section-text" style="color:#94a3b8;">Chưa có bài tập — vui lòng mở lại trang phân tích và nhấn "Lưu kết quả".</p>`;
      return lessons.map((l: any, idx: number) => {
        const steps = (l.steps ?? []).map((s: any, i: number) =>
          `<li style="margin-bottom:6px;">${escHtml(String(s.description ?? s.title ?? s))}</li>`
        ).join("");
        const approach = (l.lessonType ?? l.vmType ?? "").replace(/_/g, " ").toUpperCase();
        const badge = approach ? therapyBadge(approach) : "";
        return `
  <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-left:4px solid #1d4ed8;border-radius:0 12px 12px 0;padding:0;overflow:hidden;page-break-inside:avoid;">
    <div style="background:#f0f7ff;padding:14px 18px 10px;">
      <div style="font-size:14px;font-weight:800;color:#1e3a5f;margin-bottom:4px;">Bài ${idx + 1} &nbsp; ${escHtml(l.title ?? "Bài học")}</div>
      ${l.rationale ? `<div style="font-size:11px;color:#64748b;font-style:italic;margin-bottom:6px;">${escHtml(l.rationale)}</div>` : ""}
      <div>${badge}</div>
    </div>
    <div style="padding:14px 18px;">
      ${l.goals?.length ? `<div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;margin-bottom:4px;">Mục tiêu</div><div style="font-size:12px;color:#374151;font-style:italic;margin-bottom:12px;">${escHtml(l.goals[0]?.smartGoal ?? l.goals[0]?.targetBehavior ?? "")}</div>` : ""}
      ${steps ? `<div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;margin-bottom:6px;">Các bước</div><ol style="margin:0;padding-left:20px;font-size:12px;color:#374151;line-height:1.7;">${steps}</ol>` : ""}
    </div>
  </div>`;
      }).join("");
    })();

    const collaborationMsg = plan.collaborationMessage as string | undefined;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Báo cáo can thiệp — ${escHtml(childName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; max-width: 860px; margin: 0 auto; padding: 32px 40px; color: #1a1a2e; line-height: 1.6; font-size: 13px; }
    @media print { body { padding: 20px 28px; } .no-print { display: none !important; } a { text-decoration: none; } }
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

  <button class="print-btn no-print" onclick="window.print()">🖨 In / Lưu PDF</button>

  <div style="display:flex;align-items:center;gap:24px;margin-bottom:20px;">
    <div style="width:52px;height:52px;background:#1e3a5f;border-radius:12px;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:16px;font-weight:900;">NBAI</span></div>
    <div style="width:52px;height:52px;background:#1d4ed8;border-radius:12px;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:9px;font-weight:900;text-align:center;line-height:1.2;">AI4<br/>AUTISM</span></div>
    <div style="width:52px;height:52px;background:#059669;border-radius:12px;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:8px;font-weight:900;text-align:center;line-height:1.3;">JOB<br/>FOR<br/>AUTISM</span></div>
  </div>

  <h1>BÁO CÁO CAN THIỆP ĐA LIỆU PHÁP</h1>
  <p class="subtitle">Trẻ tự kỷ — Can thiệp ${escHtml(context)}</p>

  <table class="info-table">
    <thead><tr><th>Họ và tên</th><th>Ngày phân tích</th><th>Bối cảnh</th><th>Thời lượng</th><th>Mã video</th></tr></thead>
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

  <h2>I. Quan Sát Hành Vi Từ Video</h2>
  <p class="section-text">Video dài ${escHtml(duration)} ghi lại sinh hoạt của bé tại ${escHtml(context)}.</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;"><tbody>${obsRows}</tbody></table>

  ${behaviourText ? `<h3>Phân tích hành vi</h3><p class="section-text">${escHtml(behaviourText).replace(/\n/g, "<br/>")}</p>` : ""}

  <h2>II. Chiến Lược & Bài Tập Can Thiệp Đa Liệu Pháp</h2>

  ${strategyText ? `
  <h3>Chiến lược can thiệp</h3>
  <div class="strategy-box"><p style="margin:0;font-size:12px;color:#1e3a5f;">${escHtml(strategyText).replace(/\n/g, "<br/>")}</p></div>` : ""}

  ${report?.monthlyPlan?.length ? `<h3>Kế hoạch 1 tháng</h3>${monthlyPlanHtml(report.monthlyPlan)}<div style="margin-bottom:24px;"></div>` : ""}

  <h3>Bài tập cụ thể</h3>
  ${exerciseBlocks}

  ${collaborationMsg ? `
  <div class="clinical-note">
    <strong style="font-size:12px;">Lời nhắn giáo viên</strong><br/>
    ${escHtml(collaborationMsg)}
  </div>` : report?.clinicalNote ? `
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
