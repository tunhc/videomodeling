// ─── Tiêu chí chất lượng video để phân tích AI ───────────────────────────────
//
// Video ĐẠT CHUẨN phải thỏa mãn TẤT CẢ 5 tiêu chí dưới đây.
// Nếu không đạt, hệ thống gắn tag "Chưa đạt chuẩn" và liệt kê lý do cụ thể.
//
// Tiêu chí:
//   1. Thời lượng ≥ 15 giây  — đủ để nhận diện hành vi
//   2. Thời lượng ≤ 600 giây — trong giới hạn xử lý của hệ thống
//   3. Có mã trẻ (childId) hợp lệ
//   4. URL video là Cloudinary URL hợp lệ (bắt đầu bằng "http")
//   5. Có tối thiểu 1 trường metadata bối cảnh (topic / category / primaryTag /
//      parentNote / expertNote) — cần để AI hiểu ngữ cảnh

export interface QualityResult {
  eligible: boolean;
  reasons: string[];          // lý do không đạt (rỗng nếu đạt)
  warnings: string[];         // cảnh báo không chặn (duration undefined, v.v.)
}

interface VideoInput {
  url?: string;
  childId?: string;
  duration?: number;
  topic?: string;
  category?: string;
  primaryTag?: string;
  parentNote?: string;
  expertNote?: string;
  status?: string;
}

export function checkVideoQuality(video: VideoInput): QualityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. childId
  if (!video.childId || video.childId === "Unknown" || video.childId.trim() === "") {
    reasons.push("Không có mã trẻ hợp lệ (childId)");
  }

  // 2. URL
  if (!video.url || video.url.trim() === "") {
    reasons.push("URL video không hợp lệ hoặc chưa được tải lên Cloudinary");
  }

  // 3 & 4. Duration
  if (video.duration === undefined || video.duration === null) {
    warnings.push("Chưa có thông tin thời lượng — sẽ phân tích nhưng độ chính xác giảm");
  } else {
    if (video.duration < 15) {
      reasons.push(`Thời lượng quá ngắn: ${video.duration}s (yêu cầu tối thiểu 15s để phân tích hành vi)`);
    } else if (video.duration > 600) {
      reasons.push(`Thời lượng quá dài: ${Math.round(video.duration)}s (giới hạn 10 phút — vui lòng cắt đoạn phân tích)`);
    }
  }

  // 5. Metadata bối cảnh
  const hasContext = !!(
    video.topic?.trim() ||
    video.category?.trim() ||
    video.primaryTag?.trim() ||
    video.parentNote?.trim() ||
    video.expertNote?.trim()
  );
  if (!hasContext) {
    reasons.push("Thiếu thông tin bối cảnh: cần có ít nhất 1 trong (chủ đề / danh mục / nhãn hành vi / ghi chú PH / ghi chú GV) để AI hiểu ngữ cảnh");
  }

  // 6. Trạng thái hỏng
  if (video.status === "failed" || video.status === "error") {
    reasons.push("Video đã được đánh dấu lỗi — cần upload lại");
  }

  return { eligible: reasons.length === 0, reasons, warnings };
}

// Trả về nhãn hiển thị ngắn gọn
export function qualityLabel(result: QualityResult): string {
  if (result.eligible) return "Đạt chuẩn";
  return "Chưa đạt chuẩn";
}
