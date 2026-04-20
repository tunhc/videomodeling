"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ChevronLeft, Brain, Video, MessageSquare,
  ShieldCheck, CheckCircle2, AlertTriangle, Activity,
  TrendingUp, BookOpen, Star, Check, X
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, addDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { videoService } from "@/lib/services/videoService";
import { aiNoteAnalyser } from "@/lib/services/ai-note-analyser";
import type { VideoAnalysisResult } from "@/lib/claude";

export default function ParentAnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F6FF] flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>}>
      <AnalyzeContent />
    </Suspense>
  );
}

const HPDT_DOMAINS = [
  { key: "social" as const, label: "Xã hội", color: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-700" },
  { key: "cognitive" as const, label: "Nhận thức", color: "bg-purple-500", light: "bg-purple-50", text: "text-purple-700" },
  { key: "behavior" as const, label: "Hành vi", color: "bg-amber-500", light: "bg-amber-50", text: "text-amber-700" },
  { key: "sensory" as const, label: "Giác quan", color: "bg-pink-500", light: "bg-pink-50", text: "text-pink-700" },
  { key: "motor" as const, label: "Vận động", color: "bg-sky-500", light: "bg-sky-50", text: "text-sky-700" },
];

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get("id");
  const [video, setVideo] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"scanning" | "ai" | "done">("scanning");
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const analysisStarted = useRef(false);

  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const runAnalysis = useCallback(async (v: any, dur: number) => {
    if (!v?.id) return;
    setPhase("ai");
    setProgress(40);
    try {
      const res = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: videoId,
          childId: v.childId,
          teacherId: "parent",
          senderRole: "parent",
          childState: v.childState || "bình thường",
          locationNote: v.location || v.context || "tại nhà"
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `API ${res.status}`);
      }
      const data = await res.json();
      setAnalysisId(data.analysisId);
      setResult(data.frameAnalysis);
      
      if (data.frameAnalysis.suggestedNote) setNote(data.frameAnalysis.suggestedNote);
      setProgress(100);
      setPhase("done");
      setIsAnalyzing(false);
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Phân tích AI gặp sự cố. Vui lòng thử lại.");
      setProgress(100);
      setPhase("done");
      setIsAnalyzing(false);
    }
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    async function load() {
      const data = await videoService.getVideoById(videoId!);
      if (data) {
        setVideo({ ...data, title: data.topic || "Video phân tích" });
        setIsAnalyzing(true);
        setProgress(5);
        // Initial progress animation
        const t = setInterval(() => setProgress(p => { if (p >= 35) { clearInterval(t); return 35; } return p + 3; }), 150);
        return () => clearInterval(t);
      }
    }
    load();
  }, [videoId]);

  useEffect(() => {
    if (video && !analysisStarted.current) {
      analysisStarted.current = true;
      runAnalysis(video, video.duration || 0);
    }
  }, [video, runAnalysis]);

  const handleSave = async () => {
    if (!video || !analysisId || saving) return;
    setSaving(true);
    try {
      // 1. Update the analysis doc with parent's note
      await setDoc(doc(db, "video_analysis", analysisId), { 
        diary_notes: note,
        parentConfirmedAt: new Date()
      }, { merge: true });

      // 2. Process note iteration if any
      if (note) {
        await aiNoteAnalyser.analyzeNoteIteration(note, video.childId || "", video.id?.toString() || "", "parent");
      }

      // 3. Call the confirm API to finalize stats and lessons
      const res = await fetch("/api/analyze-video/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          videoId: video.id,
          childId: video.childId,
          teacherId: "parent"
        }),
      });

      if (!res.ok) throw new Error("Confirmation failed");

      setSaved(true);
      setTimeout(() => router.push("/parent"), 1200);
    } catch (e) {
      console.error("Save failed:", e);
      setSaving(false);
      alert("Không thể lưu kết quả. Vui lòng thử lại.");
    }
  };

  if (!video) {
    return (
      <div className="min-h-screen bg-[#F8F6FF] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
        <p className="text-gray-500 font-semibold">Đang phân tích video...</p>
      </div>
    );
  }

  const vq = result?.videoQuality;
  const hpdt = result?.hpdt;
  const overall = hpdt?.overall ?? 0;

  const LIGHTING_LABEL: Record<string, string> = { good: "Đủ sáng ✓", acceptable: "Hơi tối", poor: "Tối quá ✗" };
  const SHARPNESS_LABEL: Record<string, string> = { sharp: "Nét rõ ✓", acceptable: "Hơi mờ", blurry: "Mờ quá ✗" };
  const LIGHTING_COLOR: Record<string, string> = { good: "text-emerald-600 bg-emerald-50 border-emerald-200", acceptable: "text-amber-600 bg-amber-50 border-amber-200", poor: "text-red-600 bg-red-50 border-red-200" };
  const SHARPNESS_COLOR: Record<string, string> = { sharp: "text-emerald-600 bg-emerald-50 border-emerald-200", acceptable: "text-amber-600 bg-amber-50 border-amber-200", blurry: "text-red-600 bg-red-50 border-red-200" };

  return (
    <div className="min-h-screen bg-[#F8F6FF] pb-24 font-lexend">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/parent")} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center"><Brain size={14} className="text-white" /></span>
              Phân tích AI
            </h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{video.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isAnalyzing && (
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20"
            >
              {saved ? <><CheckCircle2 size={14} /> Đã lưu</> : saving ? <><Loader2 size={14} className="animate-spin" /> Đang xử lý...</> : <><Check size={14} /> Đồng ý và lưu</>}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Video + AI Scanning overlay */}
        <div className="relative rounded-[28px] overflow-hidden bg-black shadow-2xl shadow-black/20 aspect-[16/9] max-h-64">
          {video?.url && (
            <video
              ref={videoRef}
              src={video.url}
              className="w-full h-full object-contain"
              autoPlay muted loop playsInline
              onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
            />
          )}
          <AnimatePresence>
            {isAnalyzing && (
              <motion.div exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <Loader2 size={48} className={`animate-spin ${phase === "ai" ? "text-purple-400" : "text-indigo-400"}`} />
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">{progress}%</div>
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-sm">{phase === "ai" ? "AI đang phân tích..." : "Đang quét video..."}</p>
                  <p className="text-white/50 text-[10px] mt-1">Vui lòng chờ trong giây lát</p>
                </div>
                <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${phase === "ai" ? "bg-purple-400" : "bg-indigo-400"}`} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-semibold">{error}</p>
          </div>
        )}

        {!isAnalyzing && result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Video Quality */}
            {vq && (
              <section className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-black text-gray-800 flex items-center gap-2 text-sm">
                    <Video size={16} className="text-indigo-500" /> Chất lượng Video
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${vq.overallPass ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {vq.overallPass ? "✓ Đạt chuẩn" : "⚠ Cần cải thiện"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className={`rounded-2xl px-3 py-2.5 border text-center ${LIGHTING_COLOR[vq.lighting] ?? "bg-gray-50 border-gray-200 text-gray-500"}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Ánh sáng</p>
                    <p className="text-xs font-black">{LIGHTING_LABEL[vq.lighting] ?? vq.lighting}</p>
                  </div>
                  <div className={`rounded-2xl px-3 py-2.5 border text-center ${SHARPNESS_COLOR[vq.sharpness] ?? "bg-gray-50 border-gray-200 text-gray-500"}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Độ nét</p>
                    <p className="text-xs font-black">{SHARPNESS_LABEL[vq.sharpness] ?? vq.sharpness}</p>
                  </div>
                  <div className={`rounded-2xl px-3 py-2.5 border text-center ${vq.frontView ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Chính diện</p>
                    <p className="text-xs font-black">{vq.frontView ? "✓ Có" : "✗ Không"}</p>
                  </div>
                  <div className={`rounded-2xl px-3 py-2.5 border text-center ${vq.sideView45 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Góc 45°</p>
                    <p className="text-xs font-black">{vq.sideView45 ? "✓ Có" : "✗ Không"}</p>
                  </div>
                </div>
                {vq.warnings?.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {vq.warnings.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-700 font-semibold">
                        <span className="mt-0.5 flex-shrink-0">⚠</span> {w}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* HPDT Score */}
            <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[24px] p-5 text-white shadow-xl shadow-indigo-500/25">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-sm flex items-center gap-2 opacity-90">
                  <Star size={16} /> Điểm HPDT từ Video
                </h2>
                <div className="text-right">
                  <span className="text-4xl font-black">{overall}</span>
                  <span className="text-lg opacity-60">/100</span>
                </div>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${overall}%` }} transition={{ duration: 1, delay: 0.2 }}
                  className="h-full bg-white rounded-full" />
              </div>
              <div className="space-y-2.5">
                {HPDT_DOMAINS.map(d => (
                  <div key={d.key} className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-70 w-16 flex-shrink-0">{d.label}</span>
                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${hpdt?.[d.key] ?? 0}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                        className="h-full bg-white/80 rounded-full" />
                    </div>
                    <span className="text-[11px] font-mono font-black opacity-80 w-8 text-right">{hpdt?.[d.key] ?? 0}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Behavior Segments */}
            {result.milestones && result.milestones.length > 0 && (
              <section className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5">
                <h2 className="font-black text-gray-800 flex items-center gap-2 text-sm mb-4">
                  <Activity size={16} className="text-purple-500" /> Chặng hành vi
                </h2>
                <div className="space-y-2">
                  {result.milestones.map((m: any, i: number) => {
                    const domainConfig: Record<string, string> = {
                      Social: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      Cognitive: "bg-purple-50 text-purple-700 border-purple-200",
                      Behavior: "bg-amber-50 text-amber-700 border-amber-200",
                      Sensory: "bg-pink-50 text-pink-700 border-pink-200",
                      Motor: "bg-sky-50 text-sky-700 border-sky-200",
                    };
                    const score = m.eyeContact ?? m.score ?? 0;
                    const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-400" : "bg-red-400";
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 ${color}`}>{score}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-gray-800 truncate">{m.label}</p>
                          <p className="text-[10px] text-gray-400 font-bold">{m.second}s</p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-1 rounded-xl border flex-shrink-0 ${domainConfig[m.domain] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>{m.domain}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* AI Summary */}
            {result.summary && (
              <section className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-[24px] border border-indigo-100 p-5">
                <h2 className="font-black text-indigo-700 flex items-center gap-2 text-sm mb-3">
                  <Brain size={16} /> Nhận xét từ AI
                </h2>
                <p className="text-sm text-indigo-900 leading-relaxed">{result.summary}</p>
              </section>
            )}

            {/* Overall Recommendation */}
            {result.suggestedNote && (
              <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[24px] border border-emerald-100 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="font-black text-emerald-700 flex items-center gap-2 text-sm">
                    <TrendingUp size={16} /> Khuyến nghị tổng thể
                  </h2>
                  <button
                    onClick={() => router.push("/parent/library")}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all flex-shrink-0"
                  >
                    <BookOpen size={11} /> Thư viện bài tập
                  </button>
                </div>
                <p className="text-sm text-emerald-900 leading-relaxed">{result.suggestedNote}</p>
                <div className="mt-4 p-3 bg-white/60 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-1.5">📚 Xem báo cáo PDF đầy đủ</p>
                  <p className="text-xs text-gray-600">Sau khi lưu, bạn có thể xem báo cáo PDF chi tiết tại trang <strong>Thư viện phân tích AI</strong> trong mục Video Modeling của bé.</p>
                </div>
              </section>
            )}

            {/* Tags */}
            {result.tags && result.tags.length > 0 && (
              <section className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5">
                <h2 className="font-black text-gray-700 text-sm mb-3">🏷️ Nhãn hành vi</h2>
                <div className="flex flex-wrap gap-2">
                  {result.tags.map((tag: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-black">{tag}</span>
                  ))}
                </div>
              </section>
            )}

            {/* Note input */}
            <section className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5">
              <h2 className="font-black text-gray-800 flex items-center gap-2 text-sm mb-3">
                <MessageSquare size={16} className="text-emerald-500" /> Ghi chú can thiệp
              </h2>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Nhập ghi chú, quan sát, hoặc lời nhắn cho giáo viên..."
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none h-28"
              />
            </section>

            {/* Bottom save buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-indigo-500/25"
              >
                {saved ? <><CheckCircle2 size={18} /> Đã lưu thành công!</> : saving ? <><Loader2 size={18} className="animate-spin" /> Đang xử lý...</> : <><Check size={18} /> Đồng ý và lưu kết quả</>}
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {saved && (
        <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-8 left-4 right-4 max-w-sm mx-auto bg-emerald-600 text-white rounded-[20px] p-4 flex items-center gap-3 shadow-2xl z-50">
          <CheckCircle2 size={20} />
          <div>
            <p className="font-black text-sm">Lưu thành công!</p>
            <p className="text-[11px] opacity-80">Đang quay về trang chủ...</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
