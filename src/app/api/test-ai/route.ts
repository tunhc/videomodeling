import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.GOOGLE_GEMINI_API_KEY?.trim();

  const result: Record<string, unknown> = {
    keyPresent: !!key,
    keyPrefix: key ? `${key.substring(0, 8)}...` : "MISSING",
    keyLength: key?.length ?? 0,
  };

  if (!key) {
    return NextResponse.json({ ...result, error: "GOOGLE_GEMINI_API_KEY missing in .env.local" }, { status: 400 });
  }

  // Test 1: gemini-2.0-flash text
  for (const modelName of ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"]) {
    try {
      const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: modelName });
      const r = await model.generateContent("Say OK in one word.");
      result[`text_${modelName}`] = r.response.text().trim().substring(0, 30);
    } catch (e: any) {
      result[`text_${modelName}_error`] = e?.message ?? String(e);
    }
  }

  // Test 2: Cloudinary fetch (can server reach external URLs?)
  try {
    const testFetch = await fetch("https://httpbin.org/get", { signal: AbortSignal.timeout(8000) });
    result["externalFetch"] = testFetch.ok ? "OK" : `HTTP ${testFetch.status}`;
  } catch (e: any) {
    result["externalFetch_error"] = e?.message;
  }

  // Test 3: Gemini API endpoint reachable?
  try {
    const testGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      signal: AbortSignal.timeout(10000),
    });
    const body = await testGemini.json();
    result["geminiEndpointStatus"] = testGemini.status;
    result["geminiModels"] = (body.models ?? []).slice(0, 5).map((m: any) => m.name);
    if (body.error) result["geminiEndpointError"] = body.error;
  } catch (e: any) {
    result["geminiEndpoint_error"] = e?.message;
  }

  return NextResponse.json(result, { status: 200 });
}
