"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  PenTool, Circle, Square, Trash2, Pause, Maximize2, 
  ShieldCheck, Camera, Loader2, Tag, ChevronRight, 
  MessageSquare, Video, Check, Info, Library, Play, Sparkles,
  Trash
} from "lucide-react";
import { useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, setDoc, addDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { videoService } from "@/lib/services/videoService";

import { aiNoteAnalyser } from "@/lib/services/ai-note-analyser";

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
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [tags, setTags] = useState([
    { id: 1, label: "Chào hỏi", auto: true, confirmed: false },
    { id: 2, label: "Tại trường", auto: true, confirmed: false },
    { id: 3, label: "Phối hợp miệng", auto: true, confirmed: false }
  ]);
  const [suggestedTags, setSuggestedTags] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [trackingPos, setTrackingPos] = useState({ x: 50, y: 35 });
  const [aiState, setAiState] = useState({ eyeContact: 85, emotion: "Tích cực", blinkCount: 12 });
  const [milestones, setMilestones] = useState<any[]>([]);
  const [hpdtResults, setHpdtResults] = useState({
    social: 0,
    cognitive: 0,
    behavior: 0,
    sensory: 0,
    motor: 0,
    overall: 0
  });

  // Video State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!videoRef.current || videoDuration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, clientX - rect.left);
    const percent = x / rect.width;
    const newTime = percent * videoDuration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    if (!isAnalyzing && selectedVideo && isPlaying) {
      // Simulate landmark points jitter AND movement
      const interval = setInterval(() => {
        setAiState(prev => ({
          eyeContact: Math.floor(Math.random() * 15) + 80,
          emotion: Math.random() > 0.8 ? "Bình thường" : "Tích cực",
          blinkCount: prev.blinkCount + (Math.random() > 0.9 ? 1 : 0)
        }));

        // Auto move scanning frame towards a "face" area
        setTrackingPos(prev => {
           const speed = 0.5;
           const targetX = 50 + Math.sin(Date.now() / 2000) * 20;
           const targetY = 35 + Math.cos(Date.now() / 3000) * 10;
           return {
             x: prev.x + (targetX - prev.x) * speed * 0.1,
             y: prev.y + (targetY - prev.y) * speed * 0.1
           };
        });
      }, 100);

      if (progress >= 100 && milestones.length === 0) {
        generateMilestones();
      }

      return () => clearInterval(interval);
    }
  }, [isAnalyzing, selectedVideo, progress, isPlaying]);

  const generateMilestones = () => {
    const duration = 132;
    const segments = 6;
    const newMilestones = [];
    
    for (let i = 1; i <= segments; i++) {
      const time = Math.floor((duration / segments) * i);
      const eyeContact = Math.floor(Math.random() * 20) + 75;
      const score = Math.floor(Math.random() * 15) + 80;
      newMilestones.push({
        time,
        eyeContact,
        score,
        label: i % 2 === 0 ? "Tương tác tốt" : "Đang tập trung",
        domain: i % 3 === 0 ? "Social" : "Cognitive"
      });
    }
    setMilestones(newMilestones);
    calculateFinalMetrics(newMilestones);
  };

  const calculateFinalMetrics = (ms: any[]) => {
    const avgEyeContact = ms.reduce((acc, m) => acc + m.eyeContact, 0) / ms.length;
    const confirmedTags = tags.filter(t => t.confirmed);
    const socialBonus = confirmedTags.some(t => t.label === "Chào hỏi") ? 5 : 0;
    
    const results = {
      social: Math.min(100, (avgEyeContact / 0.8) + socialBonus),
      cognitive: Math.min(100, 70 + (confirmedTags.length * 4)),
      behavior: Math.min(100, 85 - (Math.random() * 10)),
      sensory: Math.min(100, 75 + (Math.random() * 5)),
      motor: Math.min(100, 65 + (Math.random() * 10)),
      overall: 0
    };
    
    results.overall = Math.floor((results.social + results.cognitive + results.behavior + results.sensory + results.motor) / 5);
    setHpdtResults(results);
  };

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!videoId) return;

    async function loadVideo() {
      try {
        const data = await videoService.getVideoById(videoId as string);
        if (data) {
          setSelectedVideo({
            ...data,
            title: data.topic || "Video phân tích"
          });
          setIsAnalyzing(true);
          setProgress(0);
        }
      } catch (error) {
        console.error("Lỗi load video:", error);
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, [videoId]);

  useEffect(() => {
    if (selectedVideo) {
      const fetchSuggestions = async () => {
        const suggestions = await aiNoteAnalyser.getSuggestedTags("minh-khoi");
        setSuggestedTags(suggestions);
      };
      fetchSuggestions();
    }
  }, [selectedVideo]);

  useEffect(() => {
    if (isAnalyzing && selectedVideo) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsAnalyzing(false);
            return 100;
          }
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing, selectedVideo]);

  const handleSaveNote = async () => {
    if (!note) return;
    setIsSavingNote(true);
    try {
      await aiNoteAnalyser.analyzeNoteIteration(note, "minh-khoi", selectedVideo.id.toString(), "parent");
      const suggestions = await aiNoteAnalyser.getSuggestedTags("minh-khoi");
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
      await handleSaveNote();
      
      const analysisRef = collection(db, "video_analysis");
      const analysisData = {
        videoId: selectedVideo.id,
        childId: selectedVideo.childId,
        teacherId: selectedVideo.teacherId || "SYSTEM",
        milestones: milestones,
        hpdtAverages: hpdtResults,
        finalSuccessRate: hpdtResults.overall,
        createdAt: new Date(),
        videoDuration: selectedVideo.duration || 0,
        senderRole: "parent"
      };
      await addDoc(analysisRef, analysisData);
      
      const videoRef = doc(db, "video_modeling", selectedVideo.id);
      await setDoc(videoRef, { status: "Đã phân tích" }, { merge: true });

      if (selectedVideo.childId) {
        const childRef = doc(db, "children", selectedVideo.childId);
        await setDoc(childRef, { 
          hpdt: hpdtResults.overall,
          lastAnalysisAt: new Date()
        }, { merge: true });
      }

      alert("Lưu kết quả thành công! Bạn đang quay lại trang chủ.");
      router.push("/parent");
      setMilestones([]);
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
      <header className="flex justify-between items-center mb-8 bg-[#161B22]/50 backdrop-blur-md p-6 rounded-[32px] border border-[#30363D]">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.push("/parent")}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-[#30363D] transition-all"
          >
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#58A6FF] flex items-center gap-3">
              <span className="bg-[#58A6FF]/20 p-2 rounded-xl text-[#58A6FF]">AI</span>
              ANALYSIS <span className="text-white">PARENT</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-widest opacity-50">Video: {selectedVideo.title}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col xl:flex-row gap-8 flex-1">
        <div className="flex-1 flex gap-8 flex-col lg:flex-row">
          <div className="relative w-full max-w-[360px] mx-auto aspect-[9/16] bg-black rounded-[40px] overflow-hidden border border-[#30363D] shadow-2xl group shrink-0">
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div 
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center space-y-6 px-4"
                >
                  <div className="relative">
                    <Loader2 size={60} className="text-[#58A6FF] animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                      {progress}%
                    </div>
                  </div>
                  <h3 className="text-lg font-black tracking-widest text-white uppercase italic">AI SCANNING...</h3>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute inset-0 flex items-center justify-center bg-[#0B0E14]">
               {selectedVideo?.url && (
                 <video 
                   ref={videoRef}
                   src={selectedVideo.url} 
                   className="w-full h-full object-contain brightness-110" 
                   autoPlay 
                   muted 
                   loop
                   playsInline
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
              <div onClick={handleSeek} className="flex-1 mx-3 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer relative">
                <div style={{ width: `${(currentTime / videoDuration) * 100}%` }} className="h-full bg-[#58A6FF]" />
              </div>
              <div className="text-[8px] font-mono text-gray-500">{formatTime(currentTime)}</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-8">
            <section className="bg-[#161B22]/50 p-8 rounded-[40px] border border-[#30363D] space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Video Tags</h4>
              <div className="flex flex-wrap gap-3">
                {tags.map(tag => (
                   <button 
                    key={tag.id}
                    onClick={() => toggleConfirm(tag.id)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                      tag.confirmed ? 'bg-[#58A6FF] border-[#58A6FF] text-white shadow-lg' : 'bg-white/5 border-[#30363D] text-gray-400'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-[#161B22]/50 p-10 rounded-[40px] border border-[#30363D] space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Ghi chú cho Cô giáo</h4>
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú tại đây..."
                className="w-full bg-[#0B0E14] border border-[#30363D] rounded-3xl p-6 text-sm text-white h-32 resize-none"
              />
            </section>
          </div>
        </div>

        <aside className="w-full lg:w-[380px] space-y-8">
           <div className="bg-[#161B22] border border-[#30363D] rounded-[40px] p-10 space-y-10 shadow-hpdt">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#58A6FF]">Tỉ lệ Thành công</h3>
                <div className="text-5xl font-black text-white italic">{hpdtResults.overall}%</div>
              </div>

              <div className="space-y-6">
                <button 
                  onClick={handleFinishAnalysis}
                  disabled={isSavingNote}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-3xl font-black text-sm uppercase flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSavingNote ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                  HOÀN TẤT & LƯU
                </button>
              </div>

              <div className="pt-8 border-t border-[#30363D] space-y-4">
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
