"use server";

export interface ClaudeAnalysisPayload {
  videoUrl: string;
  duration: number;
  childContext?: {
    childId?: string;
    primaryTag?: string;
    context?: string;
    topic?: string;
  };
}

/**
 * Server action: analyze a video using Claude Vision via the /api/analyze-video endpoint.
 * Returns structured behavioral analysis result.
 */
export async function analyzeVideoAction(payload: ClaudeAnalysisPayload) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/analyze-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    // Allow up to 60 seconds for Claude to analyze
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}
