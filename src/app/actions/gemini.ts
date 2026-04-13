"use server";

import { getGeminiResponse } from "@/lib/gemini";

export async function askVST(prompt: string, context?: any, skill?: string) {
  return await getGeminiResponse(prompt, context, skill);
}

export async function generateLessonPlanAction(childStats: any, domain: string) {
  const prompt = `Hãy tạo một giáo án (Lesson Plan) can thiệp cho trẻ tự kỷ trong lĩnh vực ${domain}.
  Dữ liệu hiện tại của trẻ là: ${JSON.stringify(childStats)}.
  Giáo án cần bao gồm:
  1. Mục tiêu (Objective)
  2. Các bước thực hiện Video Modeling (Steps)
  3. Lưu ý quan trọng (Notes)
  Trả lời ngắn gọn, súc tích bằng tiếng Việt.`;
  
  return await getGeminiResponse(prompt, childStats, "pediatric-intervention-coach");
}

export async function generateWeeklyComboAction(childStats: any, childName: string) {
  const prompt = `Hãy thiết kế một "Combo Can Thiệp Tuần" (Weekly Intervention Combo) chuẩn ABA/VB cho bé ${childName}.
  Số liệu HPDT của bé: ${JSON.stringify(childStats)}.
  
  Yêu cầu:
  1. Đề xuất 4-5 bài tập quan trọng nhất cần lặp lại trong tuần.
  2. Mỗi bài tập cần có: Tên bài (lesson), Nhãn (category - chọn trong: Giao tiếp, Vận động, Tự phục vụ, Xã hội, Hành vi), và Mô tả ngắn.
  3. Trả về danh sách rõ ràng, súc tích bằng tiếng Việt.`;

  return await getGeminiResponse(prompt, childStats, "pediatric-intervention-coach");
}

export async function generateWeeklyScheduleAction(childStats: any, childName: string) {
  const prompt = `Hãy thiết kế một "Lịch dạy chi tiết theo tuần" (Weekly Teaching Schedule) cho bé ${childName} chuẩn ABA/VB.
  Số liệu HPDT của bé: ${JSON.stringify(childStats)}.
  
  Yêu cầu:
  1. Lịch bắt đầu từ Thứ 2 đến Chủ nhật (7 ngày).
  2. Mỗi ngày đề xuất đúng 3 bài học ngắn (Sáng, Trưa, Chiều).
  3. Cần cân bằng đều các miền (Giao tiếp, Xã hội, Vận động, Tự phục vụ, Hành vi).
  4. Đánh dấu ít nhất 1 bài học mỗi ngày là "Video Modeling" (requiresModeling: true) nếu phù hợp để quay phim làm mẫu.
  5. ĐỊNH DẠNG TRẢ VỀ: Trả về một JSON array duy nhất các ngày, mỗi ngày có: { day: string, activities: [{ title, description, domain, requiresModeling }] }.
  6. Trả lời bằng tiếng Việt.`;

  return await getGeminiResponse(prompt, childStats, "pediatric-intervention-coach");
}

export async function generateDailyScheduleAction(childStats: any, childName: string) {
  const prompt = `Hãy thiết kế một "Lộ trình hôm nay" (Daily Roadmap) cho bé ${childName} chuẩn ABA/VB. 
  Dữ liệu hiện tại: ${JSON.stringify(childStats)}.
  
  Yêu cầu:
  1. Đề xuất đúng 3 bài học (Sáng, Trưa, Chiều).
  2. Mỗi bài tập cần có: title, description, domain, và requiresModeling (true nếu cần dùng video mẫu).
  3. Trả về ĐỊNH DẠNG JSON array duy nhất: [{ title, description, domain, requiresModeling }].
  4. Trả lời bằng tiếng Việt, súc tích.`;

  return await getGeminiResponse(prompt, childStats, "pediatric-intervention-coach");
}
