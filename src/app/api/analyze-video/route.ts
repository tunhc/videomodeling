import { NextRequest, NextResponse } from "next/server";
import { analyzeVideoFrames } from "@/lib/claude";

export const runtime = "nodejs";

// Allow up to 60 seconds for Claude vision analysis
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl, duration, childContext } = body as {
      videoUrl: string;
      duration: number;
      childContext?: {
        childId?: string;
        primaryTag?: string;
        context?: string;
        topic?: string;
      };
    };

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "No AI API Keys configured" },
        { status: 500 }
      );
    }

    const result = await analyzeVideoFrames(
      videoUrl,
      duration ?? 60,
      childContext ?? {}
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[analyze-video] Error:", error);
    return NextResponse.json(
      { error: "Analysis failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
