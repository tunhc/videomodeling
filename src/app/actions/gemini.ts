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
