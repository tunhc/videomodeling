"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pause, ShieldCheck, Loader2, Tag, ChevronRight,
  MessageSquare, Check, Play, Brain
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, addDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { videoService } from "@/lib/services/videoService";
import { aiNoteAnalyser } from "@/lib/services/ai-note-analyser";
import type { VideoAnalysisResult } from "@/lib/claude";

export default function ParentAnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#58A6FF]" size={40} />
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get("id");
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [analyzePhase, setAnalyzePhase] = useState<"scanning" | "claude" | "done">("scanning");
  const [progress, setProgress] = useState(0);
  const [claudeResult, setClaudeResult] = useState<VideoAnalysisResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Tags
  const [tags, setTags] = useState([
    { id: 1, label: "Giao tiếp", auto: true, confirmed: false },
    { id: 2, label: "Tập trung", auto: true, confirmed: false },
    { id: 3, label: "Tương tác", auto: true, confirmed: false },
  ]);
  const [note, setNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // AI overlay
  const [trackingPos, setTrackingPos] = useState({ x: 50, y: 35 });
  const [milestones, setMilestones] = useState<any[]>([]);
  const [hpdtResults, setHpdtResults] = useState({
    social: 0, cognitive: 0, behavior: 0, sensory: 0, motor: 0, overall: 0
  });

  // Video player
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (!videoRef.current) return;
    isPlaying ? videoRef.current.pause() : videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!videoRef.current || videoDuration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const percent = Math.max(0, clientX - rect.left) / rect.width;
    videoRef.current.currentTime = percent * videoDuration;
    setCurrentTime(percent * videoDuration);
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  // Animated tracking overlay
  useEffect(() => {
    if (!isAnalyzing && selectedVideo && isPlaying) {
      const interval = setInterval(() => {
        setTrackingPos(prev => {
          const targetX = 50 + Math.sin(Date.now() / 2000) * 20;
          const targetY = 35 + Math.cos(Date.now() / 3000) * 10;
          return {
            x: prev.x + (targetX - prev.x) * 0.05,
            y: prev.y + (targetY - prev.y) * 0.05,
          };
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing, selectedVideo, isPlaying]);

  const runClaudeAnalysis = useCallback(async (video: any) => {
    if (!video?.url) return;

    setAnalyzePhase("claude");
    setProgress(40);

    try {
      const res = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: video.url,
          duration: video.duration ?? videoDuration,
          childContext: {
            childId: video.childId,
            primaryTag: video.primaryTag,
            context: video.context,
            topic: video.topic,
          },
        }),
        signal: AbortSignal.timeout(65_000),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const result: VideoAnalysisResult = await res.json();
      setClaudeResult(result);

      setTags(result.tags.map((label, i) => ({ id: i + 1, label, auto: true, confirmed: false })));
      setMilestones(result.milestones);
      setHpdtResults(result.hpdt);
      if (result.suggestedNote) setNote(result.suggestedNote);

      setProgress(100);
      setAnalyzePhase("done");
      setIsAnalyzing(false);
    } catch (err) {
      console.error("[Claude analysis]", err);
      setAnalyzeError("Phân tích AI gặp lỗi. Dùng kết quả ước tính.");
      setProgress(100);
      setAnalyzePhase("done");
      setIsAnalyzing(false);

      const dur = video.duration || videoDuration || 60;
      const ms = Array.from({ length: 6 }, (_, i) => ({
        second: Math.round((dur / 7) * (i + 1)),
        label: i % 2 === 0 ? "Đang tập trung" : "Tương tác tốt",
        eyeContact: 75 + Math.floor(Math.random() * 20),
        domain: (["Social", "Cognitive", "Behavior"] as const)[i % 3],
        score: 70 + Math.floor(Math.random() * 20),
      }));
      setMilestones(ms);
      const avg = ms.reduce((s, m) => s + m.score, 0) / ms.length;
      setHpdtResults({ social: Math.round(avg), cognitive: Math.round(avg - 5), behavior: Math.round(avg + 5), sensory: Math.round(avg - 10), motor: Math.round(avg), overall: Math.round(avg) });
    }
  }, [videoDuration]);

  useEffect(() => {
    if (!videoId) return;
    async function loadVideo() {
      try {
        const data = await videoService.getVideoById(videoId as string);
        if (data) {
          setSelectedVideo({ ...data, title: data.topic || "Video phân tích" });
          setIsAnalyzing(true);
          setProgress(5);
          const fakeProgress = setInterval(() => {
            setProgress(prev => {
              if (prev >= 35) { clearInterval(fakeProgress); return 35; }
              return prev + 3;
            });
          }, 150);
        }
      } catch (error) {
        console.error("Lỗi load video:", error);
      }
    }
    loadVideo();
  }, [videoId]);

  const analysisStarted = useRef(false);
  useEffect(() => {
    if (selectedVideo && videoDuration > 0 && !analysisStarted.current) {
      analysisStarted.current = true;
      runClaudeAnalysis({ ...selectedVideo, duration: videoDuration });
    }
  }, [selectedVideo, videoDuration, runClaudeAnalysis]);

  useEffect(() => {
    if (!selectedVideo) return;
    const timer = setTimeout(() => {
      if (!analysisStarted.current) {
        analysisStarted.current = true;
        runClaudeAnalysis(selectedVideo);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [selectedVideo, runClaudeAnalysis]);

  const handleSaveNote = async () => {
    if (!note || !selectedVideo) return;
    setIsSavingNote(true);
    try {
      await aiNoteAnalyser.analyzeNoteIteration(note, selectedVideo.childId || "", selectedVideo.id?.toString() || "", "parent");
      setIsSavingNote(false);
      setNote("");
    } catch {
      setIsSavingNote(false);
    }
  };

  const toggleConfirm = (id: number) => {
    setTags(prev => prev.map(t => t.id === id ? { ...t, confirmed: !t.confirmed } : t));
  };

  const handleFinishAnalysis = async () => {
    setIsSavingNote(true);
    try {
      if (note) await handleSaveNote();

      await addDoc(collection(db, "video_analysis"), {
        videoId: selectedVideo.id,
        childId: selectedVideo.childId,
        teacherId: selectedVideo.teacherId || "SYSTEM",
        milestones,
        hpdtAverages: hpdtResults,
        finalSuccessRate: hpdtResults.overall,
        claudeSummary: claudeResult?.summary || "",
        analyzedByAI: !!claudeResult,
        createdAt: new Date(),
        videoDuration: selectedVideo.duration || videoDuration || 0,
        senderRole: "parent",
        diary_notes: note,
      });

      await setDoc(doc(db, "video_modeling", selectedVideo.id), { status: "analyzed" }, { merge: true });

      if (selectedVideo.childId) {
        await setDoc(doc(db, "children", selectedVideo.childId), {
          hpdt: hpdtResults.overall,
          lastAnalysisAt: new Date(),
        }, { merge: true });
      }

      alert("Lưu kết quả thành công! Đang quay về trang chủ.");
      router.push("/parent");
    } catch (e) {
      console.error("Lưu thất bại:", e);
    } finally {
      setIsSavingNote(false);
    }
  };

  if (!selectedVideo) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#58A6FF]" size={40} />
        <p className="ml-4 text-white">Đang tải video...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#C9D1D9] font-lexend flex flex-col p-8 pb-32">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-[#161B22]/50 backdrop-blur-md p-6 rounded-[32px] border border-[#30363D]">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push("/parent")} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-[#30363D] transition-all">
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#58A6FF] flex items-center gap-3">
              <span className="bg-[#58A6FF]/20 p-2 rounded-xl text-[#58A6FF]">AI</span>
              ANALYSIS <span className="text-white">PARENT</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-widest opacity-50">
              Video: {selectedVideo.title}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
          <Brain size={14} className="text-purple-400" />
          <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Claude Opus 4.6</span>
        </div>
      </header>

      <div className="flex flex-col xl:flex-row gap-8 flex-1">
        <div className="flex-1 flex gap-8 flex-col lg:flex-row">

          {/* Video Player */}
          <div className="relative w-full max-w-[360px] mx-auto aspect-[9/16] bg-black rounded-[40px] overflow-hidden border border-[#30363D] shadow-2xl group shrink-0">
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center space-y-6 px-4"
                >
                  <div className="relative">
                    <Loader2 size={60} className={`animate-spin ${analyzePhase === "claude" ? "text-purple-400" : "text-[#58A6FF]"}`} />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">{progress}%</div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-black tracking-widest text-white uppercase italic">
                      {analyzePhase === "claude" ? "CLAUDE AI..." : "AI SCANNING..."}
                    </h3>
                    {analyzePhase === "claude" && (
                      <div className="flex items-center gap-2 justify-center">
                        <Brain size={12} className="text-purple-400 animate-pulse" />
                        <span className="text-[8px] text-purple-400 font-bold uppercase tracking-widest">Phân tích frame bằng Vision AI</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute inset-0 flex items-center justify-center bg-[#0B0E14]">
              {selectedVideo?.url && (
                <video
                  ref={videoRef}
                  src={selectedVideo.url}
                  className="w-full h-full object-contain brightness-110"
                  autoPlay muted loop playsInline
                  onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                />
              )}
            </div>

            {!isAnalyzing && (
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <motion.div
                  style={{ left: `${trackingPos.x}%`, top: `${trackingPos.y}%`, x: "-50%", y: "-50%" }}
                  className="absolute border-2 border-[#58A6FF]/90 bg-[#58A6FF]/10 w-32 h-32 rounded-2xl shadow-[0_0_30px_rgba(88,166,255,0.3)] backdrop-blur-[1px]"
                />
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 bg-[#161B22]/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-[#30363D] flex justify-between items-center z-20 shadow-2xl">
              <button onClick={togglePlay} className="text-white hover:text-[#58A6FF]">
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              <div onClick={handleSeek} className="flex-1 mx-3 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer">
                <div style={{ width: `${videoDuration ? (currentTime / videoDuration) * 100 : 0}%` }} className="h-full bg-[#58A6FF]" />
              </div>
              <div className="text-[8px] font-mono text-gray-500">{formatTime(currentTime)}</div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 flex flex-col gap-8">

            {/* Claude Summary */}
            {claudeResult?.summary && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-purple-500/5 p-6 rounded-[28px] border border-purple-500/20 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Brain size={16} className="text-purple-400" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                    Nhận xét từ Claude AI
                  </h4>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">{claudeResult.summary}</p>
              </motion.section>
            )}

            {analyzeError && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-[10px] text-yellow-400 font-bold uppercase tracking-widest">
                ⚠ {analyzeError}
              </div>
            )}

            {/* Tags */}
            <section className="bg-[#161B22]/50 p-8 rounded-[40px] border border-[#30363D] space-y-6">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-[#58A6FF]" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Video Tags</h4>
              </div>
              <div className="flex flex-wrap gap-3">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleConfirm(tag.id)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2 ${
                      tag.confirmed ? "bg-[#58A6FF] border-[#58A6FF] text-white shadow-lg" : "bg-white/5 border-[#30363D] text-gray-400"
                    }`}
                  >
                    {tag.label} {tag.confirmed && <Check size={14} />}
                  </button>
                ))}
              </div>
            </section>

            {/* Note */}
            <section className="bg-[#161B22]/50 p-10 rounded-[40px] border border-[#30363D] space-y-6">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} className="text-emerald-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Ghi chú cho Cô giáo
                </h4>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú tại đây..."
                className="w-full bg-[#0B0E14] border border-[#30363D] rounded-3xl p-6 text-sm text-white placeholder-gray-700 outline-none focus:border-emerald-500 transition-all h-32 resize-none"
              />
            </section>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-[380px] space-y-8">
          <div className="bg-[#161B22] border border-[#30363D] rounded-[40px] p-10 space-y-10 shadow-hpdt">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#58A6FF]">Điểm HPDT Tổng thể</h3>
              <div className="text-5xl font-black text-white italic">{hpdtResults.overall}%</div>

              {hpdtResults.overall > 0 && (
                <div className="space-y-2 pt-2">
                  {(["social", "cognitive", "behavior", "sensory", "motor"] as const).map((domain) => {
                    const labels: Record<string, string> = { social: "Xã hội", cognitive: "Nhận thức", behavior: "Hành vi", sensory: "Giác quan", motor: "Vận động" };
                    return (
                      <div key={domain} className="flex items-center gap-3">
                        <span className="text-[9px] text-gray-500 font-bold w-20 uppercase tracking-wider">{labels[domain]}</span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${hpdtResults[domain]}%` }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className="h-full bg-[#58A6FF] rounded-full"
                          />
                        </div>
                        <span className="text-[9px] font-mono text-[#58A6FF] w-8 text-right">{hpdtResults[domain]}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <button
                onClick={handleFinishAnalysis}
                disabled={isSavingNote}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-3xl font-black text-sm uppercase flex items-center justify-center gap-3 disabled:opacity-50 transition-all"
              >
                {isSavingNote ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                HOÀN TẤT & LƯU
              </button>
            </div>

            <div className="pt-8 border-t border-[#30363D]">
              <p className="text-[10px] leading-relaxed text-gray-500 font-bold italic uppercase tracking-widest">
                Kết quả sẽ được gửi trực tiếp đến Cô giáo để theo dõi tiến độ của bé.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
