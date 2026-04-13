import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const getGeminiResponse = async (prompt: string, context?: any, skillName: string = "pediatric-intervention-coach") => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Load Skill context
    let skillContext = "";
    try {
      const skillPath = path.join(process.cwd(), "skills", `${skillName}.md`);
      skillContext = await fs.readFile(skillPath, "utf-8");
    } catch (e) {
      console.warn(`Skill ${skillName} not found, using default context.`);
    }

    const systemPrompt = `
      Bạn là Trợ lý VST (Virtual Shadow Teacher) trong hệ sinh thái AI4Autism. 
      Nhiệm vụ của bạn là tư vấn các bước can thiệp cho trẻ tự kỷ dựa trên dữ liệu hpDT (Bản sao số siêu cá nhân hóa).
      
      ${skillContext ? `Sử dụng chuyên môn sau để tư vấn:\n${skillContext}` : ""}
      
      Nguyên tắc:
      - Trả lời bằng tiếng Việt, giọng điệu thấu cảm, khích lệ.
      - Sử dụng dữ liệu định lượng (ví dụ: nhịp tim, ngưỡng giác quan dB) để đưa ra lời khuyên.
      - Tập trung vào kịch bản VST: "Dạy trẻ như thế nào".
      - Nếu có dữ liệu hpDT (Cognition, Sensory, Motor, Behavior, Social), hãy lồng ghép vào phân tích.
      
      Dữ liệu của trẻ hiện tại:
      ${JSON.stringify(context || { hpdt: "75%", status: "Stable", sensoryThreshold: "80dB" })}
    `;

    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Tôi đang gặp gián đoạn kết nối. Tuy nhiên, dựa trên hpDT của bé, bạn hãy tiếp tục theo dõi các biểu hiện giác quan nhé.";
  }
};
