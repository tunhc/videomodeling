const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  // Note: The SDK might not have a direct listModels in the client, 
  // but we can try common ones.
  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-2.0-pro-exp",
    "gemini-pro"
  ];
  
  for (const name of models) {
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.generateContent("test");
      console.log(`✅ ${name} is working!`);
    } catch (e) {
      console.log(`❌ ${name} failed: ${e.message}`);
    }
  }
}

listModels();
