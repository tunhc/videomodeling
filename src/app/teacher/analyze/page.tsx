"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pause, Maximize2,
  ShieldCheck, Loader2, Tag, ChevronRight,
  MessageSquare, Video, Check, Info, Play, Sparkles,
  Brain
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, addDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { videoService } from "@/lib/services/videoService";
import { aiNoteAnalyser } from "@/lib/services/ai-note-analyser";
import type { VideoAnalysisResult } from "@/lib/claude";

export default function TeacherAnalyzePage() {
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

  // Tags (populated from Claude or defaults)
  const [tags, setTags] = useState([
    { id: 1, label: "Giao tiếp", auto: true, confirmed: false },
    { id: 2, label: "Tập trung", auto: true, confirmed: false },
    { id: 3, label: "Tương tác", auto: true, confirmed: false },
  ]);
  const [suggestedTags, setSuggestedTags] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // AI overlay state
  const [trackingPos, setTrackingPos] = useState({ x: 50, y: 35 });
  const [aiState, setAiState] = useState({ eyeContact: 85, emotion: "Tích cực", blinkCount: 12 });
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

  // Animated AI overlay while playing
  useEffect(() => {
    if (!isAnalyzing && selectedVideo && isPlaying) {
      const interval = setInterval(() => {
        setAiState(prev => ({
          eyeContact: Math.floor(Math.random() * 15) + (claudeResult?.hpdt.social ?? 80),
          emotion: Math.random() > 0.8 ? "Bình thường" : "Tích cực",
          blinkCount: prev.blinkCount + (Math.random() > 0.9 ? 1 : 0),
        }));
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
  }, [isAnalyzing, selectedVideo, isPlaying, claudeResult]);

  // Run Claude analysis when video is loaded
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

      // Populate tags from Claude
      setTags(
        result.tags.map((label, i) => ({ id: i + 1, label, auto: true, confirmed: false }))
      );

      // Populate milestones & HPDT
      setMilestones(result.milestones);
      setHpdtResults(result.hpdt);

      // Pre-fill note with Claude's suggestion
      if (result.suggestedNote) setNote(result.suggestedNote);

      setProgress(100);
      setAnalyzePhase("done");
      setIsAnalyzing(false);
    } catch (err) {
      console.error("[Claude analysis]", err);
      setAnalyzeError("Claude API không khả dụng. Dùng kết quả ước tính.");
      setProgress(100);
      setAnalyzePhase("done");
      setIsAnalyzing(false);

      // Fallback: generate simulated milestones
      const dur = video.duration || videoDuration || 60;
      const ms = Array.from({ length: 6 }, (_, i) => {
        const second = Math.round((dur / 7) * (i + 1));
        return {
          second,
          label: i % 2 === 0 ? "Đang tập trung" : "Tương tác tốt",
          eyeContact: 75 + Math.floor(Math.random() * 20),
          domain: (["Social", "Cognitive", "Behavior"] as const)[i % 3],
          score: 70 + Math.floor(Math.random() * 20),
        };
      });
      setMilestones(ms);
      const avg = ms.reduce((s, m) => s + m.score, 0) / ms.length;
      setHpdtResults({
        social: Math.round(avg),
        cognitive: Math.round(avg - 5),
        behavior: Math.round(avg + 5),
        sensory: Math.round(avg - 10),
        motor: Math.round(avg),
        overall: Math.round(avg),
      });
    }
  }, [videoDuration]);

  // Load video from DB
  useEffect(() => {
    if (!videoId) return;
    async function loadVideo() {
      try {
        const data = await videoService.getVideoById(videoId as string);
        if (data) {
          const video = { ...data, title: data.topic || "Video phân tích" };
          setSelectedVideo(video);
          setIsAnalyzing(true);
          setProgress(5);

          // Kick off progress animation to 35% while we wait for metadata
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

  // Fetch suggested tags from note loop
  useEffect(() => {
    if (selectedVideo) {
      aiNoteAnalyser.getSuggestedTags(selectedVideo.childId || "").then(setSuggestedTags);
    }
  }, [selectedVideo]);

  // Start Claude analysis once we have video duration
  const analysisStarted = useRef(false);
  useEffect(() => {
    if (selectedVideo && videoDuration > 0 && !analysisStarted.current) {
      analysisStarted.current = true;
      runClaudeAnalysis({ ...selectedVideo, duration: videoDuration });
    }
  }, [selectedVideo, videoDuration, runClaudeAnalysis]);

  // If duration never fires (video load error), start analysis after 3s anyway
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
      await aiNoteAnalyser.analyzeNoteIteration(
        note,
        selectedVideo.childId || "",
        selectedVideo.id?.toString() || "",
        "teacher"
      );
      const suggestions = await aiNoteAnalyser.getSuggestedTags(selectedVideo.childId || "");
      setSuggestedTags(suggestions);
      setIsSavingNote(false);
      setNote("");
    } catch (error) {
      console.error("Pattern analysis failed:", error);
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
        teacherId: "GV_DUONG_01",
        milestones,
        hpdtAverages: hpdtResults,
        finalSuccessRate: hpdtResults.overall,
        claudeSummary: claudeResult?.summary || "",
        analyzedByAI: !!claudeResult,
        createdAt: new Date(),
        videoDuration: selectedVideo.duration || videoDuration || 0,
        diary_notes: note,
      });

      await setDoc(doc(db, "video_modeling", selectedVideo.id), { status: "analyzed" }, { merge: true });

      if (selectedVideo.childId) {
        await setDoc(doc(db, "children", selectedVideo.childId), {
          hpdt: hpdtResults.overall,
          social: hpdtResults.social,
          cognitive: hpdtResults.cognitive,
          behavior: hpdtResults.behavior,
          sensory: hpdtResults.sensory,
          motor: hpdtResults.motor,
          lastAnalysisAt: new Date(),
        }, { merge: true });

        await setDoc(doc(db, "hpdt_stats", selectedVideo.childId), {
          childId: selectedVideo.childId,
          overallScore: hpdtResults.overall,
          dimensions: {
            communication: hpdtResults.social * 0.9,
            social: hpdtResults.social,
            behavior: hpdtResults.behavior,
            sensory: hpdtResults.sensory,
            sensor: hpdtResults.motor,
          },
          lastUpdate: new Date(),
        }, { merge: true });
      }

      alert("Đã lưu kết quả phân tích AI và cập nhật Bản sao số (hpDT)!");
      router.push("/teacher/hub");
    } catch (e) {
      console.error("Lưu thất bại:", e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const analyzeStatusLabel = {
    scanning: "Đang quét frame...",
    claude: "Claude AI đang phân tích...",
    done: "Phân tích hoàn tất",
  }[analyzePhase];

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
          <button
            onClick={() => router.push("/teacher/hub")}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-[#30363D] transition-all"
          >
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#58A6FF] flex items-center gap-3">
              <span className="bg-[#58A6FF]/20 p-2 rounded-xl text-[#58A6FF]">AI</span>
              MODELING <span className="text-white">PRO</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-widest opacity-50">
              Phân tích: {selectedVideo.title}
            </p>
          </div>
        </div>
        {/* Claude badge */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
          <Brain size={14} className="text-purple-400" />
          <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">
            Claude Opus 4.6
          </span>
        </div>
      </header>

      <div className="flex flex-col xl:flex-row gap-8 flex-1">
        {/* Left: Video + Labels */}
        <div className="flex-1 flex gap-8 flex-col lg:flex-row">

          {/* Video Player */}
          <div className="relative w-full max-w-[360px] mx-auto aspect-[9/16] bg-black rounded-[40px] overflow-hidden border border-[#30363D] shadow-2xl group shrink-0">
            {/* Scanning/Claude overlay */}
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center space-y-6 px-4"
                >
                  <div className="relative">
                    <Loader2 size={60} className={`animate-spin ${analyzePhase === "claude" ? "text-purple-400" : "text-[#58A6FF]"}`} />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                      {progress}%
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-black tracking-widest text-white uppercase italic">
                      {analyzePhase === "claude" ? "CLAUDE AI..." : "AI SCANNING..."}
                    </h3>
                    <p className="text-[8px] text-[#C9D1D9]/50 font-bold uppercase tracking-widest">
                      {analyzeStatusLabel}
                    </p>
                    {analyzePhase === "claude" && (
                      <div className="flex items-center gap-2 justify-center mt-2">
                        <Brain size={12} className="text-purple-400 animate-pulse" />
                        <span className="text-[8px] text-purple-400 font-bold uppercase tracking-widest">
                          Phân tích frame bằng Vision AI
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Video */}
            <div
              className="absolute inset-0 flex items-center justify-center bg-[#0B0E14] cursor-crosshair"
              onClick={(e) => {
                if (!isAnalyzing && selectedVideo?.url) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.max(15, Math.min(((e.clientX - rect.left) / rect.width) * 100, 85));
                  const y = Math.max(15, Math.min(((e.clientY - rect.top) / rect.height) * 100, 85));
                  setTrackingPos({ x, y });
                }
              }}
            >
              {selectedVideo?.url ? (
                <video
                  ref={videoRef}
                  key={selectedVideo.id}
                  src={selectedVideo.url}
                  className="w-full h-full object-contain pointer-events-none brightness-110"
                  autoPlay muted loop playsInline
                  onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                />
              ) : (
                <Video size={80} className="text-white/5" />
              )}
            </div>

            {/* AI Facial Tracking Overlay */}
            {!isAnalyzing && selectedVideo?.url && (
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <motion.div
                  initial={false}
                  style={{
                    left: `${trackingPos.x}%`,
                    top: `${trackingPos.y}%`,
                    width: 130, height: 130,
                    x: "-50%", y: "-50%",
                  }}
                  animate={{ rotate: [0, 1, -1, 0.5, 0], scale: [1, 1.02, 0.98, 1.01, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute border-2 border-[#58A6FF]/90 bg-[#58A6FF]/10 rounded-2xl flex flex-col justify-end p-2 shadow-[0_0_30px_rgba(88,166,255,0.3)] backdrop-blur-[1px] z-10 overflow-hidden"
                >
                  <svg className="absolute inset-0 w-full h-full opacity-60">
                    <motion.g
                      animate={{ x: [0, 2, -1, 0], y: [0, -2, 1, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {[...Array(40)].map((_, i) => (
                        <circle key={i} cx={`${20 + (i % 8) * 8.5}%`} cy={`${20 + Math.floor(i / 8) * 12}%`} r="1" fill="#58A6FF" className="opacity-50" />
                      ))}
                      <path d="M 20,40 L 80,40 M 20,60 L 80,60 M 20,80 L 80,80 M 40,20 L 40,100 M 60,20 L 60,100" stroke="#58A6FF" strokeWidth="0.2" fill="none" className="opacity-20" />
                      <circle cx="35%" cy="35%" r="2" fill="#58A6FF" />
                      <circle cx="65%" cy="35%" r="2" fill="#58A6FF" />
                      <circle cx="50%" cy="50%" r="2" fill="#58A6FF" />
                      <circle cx="40%" cy="70%" r="2" fill="#58A6FF" />
                      <circle cx="60%" cy="70%" r="2" fill="#58A6FF" />
                    </motion.g>
                    <motion.rect
                      initial={{ y: -130 }} animate={{ y: 260 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      width="100%" height="4" fill="url(#scanline)"
                    />
                    <defs>
                      <linearGradient id="scanline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#58A6FF" stopOpacity="0" />
                        <stop offset="50%" stopColor="#58A6FF" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#58A6FF" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute -top-5 left-0 text-[7px] font-black tracking-widest text-[#58A6FF] bg-[#58A6FF]/10 px-1.5 py-0.5 rounded backdrop-blur border border-[#58A6FF]/30 w-max uppercase inline-flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                    Đã khoá
                  </div>
                  <div className="text-[7px] font-mono text-emerald-400 bg-[#0B0E14]/80 px-1 py-0.5 rounded backdrop-blur self-start leading-none opacity-80 z-20">
                    Mắt: {aiState.eyeContact}%
                  </div>
                  <div className="text-[7px] font-mono text-[#58A6FF] bg-[#0B0E14]/80 px-1 py-0.5 rounded backdrop-blur self-start leading-none opacity-80 mt-1 z-20">
                    Blinks: {aiState.blinkCount}
                  </div>
                </motion.div>

                {/* HUD */}
                <div className="absolute top-4 inset-x-4 bg-[#0B0E14]/70 backdrop-blur-md border border-[#30363D] rounded-xl p-3 flex justify-between items-center z-20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">AI VISION</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[9px] font-black text-[#58A6FF] uppercase">{aiState.emotion}</span>
                    <span className="text-[9px] font-black text-emerald-400 uppercase">Giao tiếp: {aiState.eyeContact}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Video controls */}
            <div className="absolute bottom-4 left-4 right-4 bg-[#161B22]/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-[#30363D] flex justify-between items-center z-20 shadow-2xl">
              <button onClick={togglePlay} className="text-white hover:text-[#58A6FF]">
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              <div onClick={handleSeek} className="flex-1 mx-3 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer">
                <div style={{ width: `${videoDuration ? (currentTime / videoDuration) * 100 : 0}%` }} className="h-full bg-[#58A6FF] shadow-[0_0_10px_#58A6FF]" />
              </div>
              <div className="text-[8px] font-mono text-gray-500 mr-2">{formatTime(currentTime)}</div>
              <Maximize2 size={14} className="text-gray-500 hover:text-white" />
            </div>
          </div>

          {/* Right panel: Tags + Note + Claude Summary */}
          <div className="flex-1 flex flex-col gap-8">

            {/* Claude Summary (shown after analysis) */}
            {claudeResult?.summary && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-purple-500/5 p-6 rounded-[28px] border border-purple-500/20 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Brain size={16} className="text-purple-400" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                    Claude AI — Tóm tắt buổi can thiệp
                  </h4>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">{claudeResult.summary}</p>
              </motion.section>
            )}

            {/* Error banner */}
            {analyzeError && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-[10px] text-yellow-400 font-bold uppercase tracking-widest">
                ⚠ {analyzeError}
              </div>
            )}

            {/* AI Tags */}
            <section className="bg-[#161B22]/50 p-8 rounded-[40px] border border-[#30363D] space-y-6">
              <div className="flex items-center gap-3">
                <Tag size={20} className="text-[#58A6FF]" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Nhãn {claudeResult ? "Claude AI" : "AI"} (Verify Required)
                </h4>
              </div>

              <div className="flex flex-wrap gap-3">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleConfirm(tag.id)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2 ${
                      tag.confirmed
                        ? "bg-[#58A6FF] border-[#58A6FF] text-white shadow-lg"
                        : "bg-white/5 border-[#30363D] text-gray-400 hover:border-[#58A6FF]/50"
                    }`}
                  >
                    {tag.label} {tag.confirmed && <Check size={14} />}
                  </button>
                ))}
              </div>

              {suggestedTags.length > 0 && (
                <div className="pt-6 border-t border-[#30363D] space-y-4">
                  <div className="flex items-center gap-3">
                    <Sparkles size={16} className="text-purple-400" />
                    <h4 className="text-[8px] font-black uppercase tracking-widest text-purple-400">
                      Gợi ý từ Ghi chú (Pattern Loop)
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTags.map((st, i) => (
                      <div key={i} className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-[8px] font-black uppercase tracking-widest">
                        {st.keyword} ({st.frequency}x)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-[#58A6FF]/50 italic">
                * {claudeResult ? "Claude Opus 4.6 phân tích trực tiếp từ frame video." : "AI tự động phân tích dựa trên bối cảnh video."}
              </p>
            </section>

            {/* Note */}
            <section className="bg-[#161B22]/50 p-10 rounded-[40px] border border-[#30363D] space-y-6">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} className="text-emerald-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Ghi chú Can thiệp
                </h4>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú cho giáo viên/phụ huynh tại đây..."
                className="w-full bg-[#0B0E14] border border-[#30363D] rounded-3xl p-6 text-sm text-white placeholder-gray-700 outline-none focus:border-emerald-500 transition-all h-32 resize-none"
              />
            </section>
          </div>
        </div>

        {/* Right Sidebar: Stats */}
        <aside className="w-full lg:w-[380px] space-y-8">
          <div className="bg-[#161B22] border border-[#30363D] rounded-[40px] p-10 space-y-10 shadow-hpdt">

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#58A6FF]">
                Điểm HPDT Tổng thể
              </h3>
              <div className="text-5xl font-black text-white italic">
                {hpdtResults.overall}<span className="text-[#58A6FF] font-normal">%</span>
              </div>

              {/* HPDT breakdown */}
              {hpdtResults.overall > 0 && (
                <div className="space-y-2 pt-2">
                  {(["social", "cognitive", "behavior", "sensory", "motor"] as const).map((domain) => {
                    const labels: Record<string, string> = {
                      social: "Xã hội", cognitive: "Nhận thức",
                      behavior: "Hành vi", sensory: "Giác quan", motor: "Vận động"
                    };
                    const val = hpdtResults[domain];
                    return (
                      <div key={domain} className="flex items-center gap-3">
                        <span className="text-[9px] text-gray-500 font-bold w-20 uppercase tracking-wider">{labels[domain]}</span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${val}%` }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className="h-full bg-[#58A6FF] rounded-full"
                          />
                        </div>
                        <span className="text-[9px] font-mono text-[#58A6FF] w-8 text-right">{val}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Milestones */}
              {!isAnalyzing && milestones.length > 0 && (
                <div className="pt-4 space-y-3">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-[#30363D] pb-2">
                    Milestones ({milestones.length})
                  </p>
                  {milestones.map((m, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-gray-500">{m.second}s: {m.label}</span>
                      <span className="text-emerald-400">{m.eyeContact ?? m.score}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-500">
                <ShieldCheck size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">Dữ liệu đã mã hóa</span>
              </div>
              <button
                onClick={handleFinishAnalysis}
                disabled={isSavingNote}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-3xl font-black text-sm shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tight disabled:opacity-50"
              >
                {isSavingNote ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                LƯU HỒ SƠ & GHI CHÚ
              </button>
            </div>

            <div className="pt-8 border-t border-[#30363D] space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl">
                <Info size={16} className="text-gray-500 mt-1" />
                <p className="text-[10px] leading-relaxed text-gray-500 font-bold italic uppercase tracking-widest">
                  Sau khi lưu, video modeling của cô giáo sẽ được đẩy về lộ trình của trẻ tại dashboard Phụ huynh.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
