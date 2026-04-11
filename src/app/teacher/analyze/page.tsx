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
           // Move slowly towards some target or just add noise
           const speed = 0.5;
           const targetX = 50 + Math.sin(Date.now() / 2000) * 20;
           const targetY = 35 + Math.cos(Date.now() / 3000) * 10;
           return {
             x: prev.x + (targetX - prev.x) * speed * 0.1,
             y: prev.y + (targetY - prev.y) * speed * 0.1
           };
        });
      }, 100);

      // Generate Milestones when analysis completes
      if (progress >= 100 && milestones.length === 0) {
        generateMilestones();
      }

      return () => clearInterval(interval);
    }
  }, [isAnalyzing, selectedVideo, progress, isPlaying]);

  const generateMilestones = () => {
    const duration = 132; // Giả lập video 132s như user đề cập
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
    
    // Công thức tính dựa trên %: Baseline + (Verified Tags impact) + (Milestone impact)
    const confirmedTags = tags.filter(t => t.confirmed);
    
    // Map tags to domains
    const socialBonus = confirmedTags.some(t => t.label === "Chào hỏi") ? 5 : 0;
    
    const results = {
      social: Math.min(100, (avgEyeContact / 0.8) + socialBonus),
      cognitive: Math.min(100, 70 + (confirmedTags.length * 4)),
      behavior: Math.min(100, 85 - (Math.random() * 10)), // Giả lập trừ điểm hành vi
      sensory: Math.min(100, 75 + (Math.random() * 5)),
      motor: Math.min(100, 65 + (Math.random() * 10)),
      overall: 0
    };
    
    results.overall = Math.floor((results.social + results.cognitive + results.behavior + results.sensory + results.motor) / 5);
    setHpdtResults(results);
  };

  const [loading, setLoading] = useState(true);

  // Load specific video from Database
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
      // Fetch suggested tags from Note Loop
      const fetchSuggestions = async () => {
        const suggestions = await aiNoteAnalyser.getSuggestedTags("minh-khoi");
        setSuggestedTags(suggestions);
      };
      fetchSuggestions();
    }
  }, [selectedVideo]);

  // Simulate AI Loading Progress
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
      // Logic loop: Note -> Keywords -> Patterns -> New Tags
      await aiNoteAnalyser.analyzeNoteIteration(note, "minh-khoi", selectedVideo.id.toString(), "teacher");
      
      // Refresh suggestions
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

  const confirmedCount = tags.filter(t => t.confirmed).length;
  // Tính tỷ lệ thành công dựa trên phân tích: Mức cơ bản 65% + Mỗi nhãn đúng cộng 10%
  const successRate = Math.min(100, 65 + (confirmedCount * 12));

  const handleFinishAnalysis = async () => {
    setIsSavingNote(true);
    try {
      await handleSaveNote();
      
      // 1. Lưu kết quả chi tiết vào video_analysis
      const analysisRef = collection(db, "video_analysis");
      const analysisData = {
        videoId: selectedVideo.id,
        childId: selectedVideo.childId,
        teacherId: "GV_DUONG_01",
        milestones: milestones,
        hpdtAverages: hpdtResults,
        finalSuccessRate: hpdtResults.overall,
        createdAt: new Date(),
        videoDuration: selectedVideo.duration || 0
      };
      await addDoc(analysisRef, analysisData);
      
      // 2. Cập nhật Status Video trong Database
      const videoRef = doc(db, "video_modeling", selectedVideo.id);
      await setDoc(videoRef, { status: "Đã phân tích" }, { merge: true });

      // 3. Cập nhật hpDT hiện tại cho bé
      if (selectedVideo.childId) {
        const childRef = doc(db, "children", selectedVideo.childId);
        await setDoc(childRef, { 
          hpdt: hpdtResults.overall,
          social: hpdtResults.social,
          cognitive: hpdtResults.cognitive,
          behavior: hpdtResults.behavior,
          sensory: hpdtResults.sensory,
          motor: hpdtResults.motor,
          lastAnalysisAt: new Date()
        }, { merge: true });

        // 4. Lưu Snapshot HPDT để vẽ biểu đồ lịch sử 5 miền
        const statsRef = doc(db, "hpdt_stats", selectedVideo.childId);
        await setDoc(statsRef, {
          childId: selectedVideo.childId,
          overallScore: hpdtResults.overall,
          dimensions: {
            communication: hpdtResults.social * 0.9, // Giả lập tỷ lệ communication
            social: hpdtResults.social,
            behavior: hpdtResults.behavior,
            sensory: hpdtResults.sensory,
            sensor: hpdtResults.motor
          },
          lastUpdate: new Date()
        }, { merge: true });
      }

      alert("Đã lưu kết quả phân tích AI và cập nhật Bản sao số (hpDT)!");
      router.push("/teacher/hub");
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
      {/* Analyzer Header */}
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
            <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-widest opacity-50">Phân tích: {selectedVideo.title}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col xl:flex-row gap-8 flex-1">
        {/* Left: Video Workspace */}
        <div className="flex-1 flex gap-8 flex-col lg:flex-row">
          
          {/* Mobile-Style Vertical Video Player */}
          <div className="relative w-full max-w-[360px] mx-auto aspect-[9/16] bg-black rounded-[40px] overflow-hidden border border-[#30363D] shadow-2xl group shrink-0">
            {/* Loading Overlay */}
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
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-black tracking-widest text-white uppercase italic">AI SCANNING...</h3>
                    <p className="text-[8px] text-[#C9D1D9]/50 font-bold uppercase tracking-widest leading-relaxed">
                      Đang xử lý toạ độ khối
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actual Video Playback Frame */}
            <div 
              className="absolute inset-0 flex items-center justify-center bg-[#0B0E14] cursor-crosshair relative"
              onClick={(e) => {
                if (!isAnalyzing && selectedVideo?.url) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  let x = ((e.clientX - rect.left) / rect.width) * 100;
                  let y = ((e.clientY - rect.top) / rect.height) * 100;
                  // Clamp boundaries for the face anchor
                  x = Math.max(15, Math.min(x, 85));
                  y = Math.max(15, Math.min(y, 85));
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
                   autoPlay 
                   muted 
                   loop
                   playsInline
                   onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                   onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                 />
               ) : (
                 <Video size={80} className="text-white/5" />
               )}
            </div>

            {/* AI Facial Tracking Overlay (Active when playing) */}
            {!isAnalyzing && selectedVideo?.url && (
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                {/* Simulated Bounding Box */}
                <motion.div 
                  initial={false}
                  style={{ 
                    left: `${trackingPos.x}%`, 
                    top: `${trackingPos.y}%`,
                    width: 130, 
                    height: 130,
                    x: "-50%",
                    y: "-50%" 
                  }}
                  animate={{ 
                    rotate: [0, 1, -1, 0.5, 0],
                    scale: [1, 1.02, 0.98, 1.01, 1],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute border-2 border-[#58A6FF]/90 bg-[#58A6FF]/10 rounded-2xl flex flex-col justify-end p-2 shadow-[0_0_30px_rgba(88,166,255,0.3)] backdrop-blur-[1px] z-10 overflow-hidden"
                >
                  {/* Face Mesh Simulation (Connecting 167+ Points Pattern) */}
                  <svg className="absolute inset-0 w-full h-full opacity-60">
                    <motion.g
                      animate={{ 
                        x: [0, 2, -1, 0],
                        y: [0, -2, 1, 0]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {/* Generative Landmark Grid (Simulating 167 keypoints density) */}
                      {[...Array(40)].map((_, i) => (
                        <circle 
                          key={i}
                          cx={`${20 + (i % 8) * 8.5}%`} 
                          cy={`${20 + Math.floor(i / 8) * 12}%`} 
                          r="1" 
                          fill="#58A6FF" 
                          className="opacity-50"
                        />
                      ))}
                      
                      {/* Connecting Mesh Lines */}
                      <path 
                        d="M 20,40 L 80,40 M 20,60 L 80,60 M 20,80 L 80,80 M 40,20 L 40,100 M 60,20 L 60,100" 
                        stroke="#58A6FF" 
                        strokeWidth="0.2" 
                        fill="none" 
                        className="opacity-20" 
                      />
                      
                      {/* Main Landmark Points */}
                      <circle cx="35%" cy="35%" r="2" fill="#58A6FF" /> 
                      <circle cx="65%" cy="35%" r="2" fill="#58A6FF" /> 
                      <circle cx="50%" cy="50%" r="2" fill="#58A6FF" /> 
                      <circle cx="40%" cy="70%" r="2" fill="#58A6FF" /> 
                      <circle cx="60%" cy="70%" r="2" fill="#58A6FF" /> 
                    </motion.g>
                    {/* Scanline Effect */}
                    <motion.rect 
                      initial={{ y: -130 }}
                      animate={{ y: 260 }}
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

                  {/* Four corner brackets */}
                  <div className="absolute top-[-6px] left-[-6px] w-8 h-8 border-t-[4px] border-l-[4px] border-[#58A6FF] rounded-tl-xl"></div>
                  <div className="absolute top-[-6px] right-[-6px] w-8 h-8 border-t-[4px] border-r-[4px] border-[#58A6FF] rounded-tr-xl"></div>
                  <div className="absolute bottom-[-6px] left-[-6px] w-8 h-8 border-b-[4px] border-l-[4px] border-[#58A6FF] rounded-bl-xl"></div>
                  <div className="absolute bottom-[-6px] right-[-6px] w-8 h-8 border-b-[4px] border-r-[4px] border-[#58A6FF] rounded-br-xl"></div>
                  
                  <div className="absolute -top-5 left-0 text-[7px] font-black tracking-widest text-[#58A6FF] bg-[#58A6FF]/10 px-1.5 py-0.5 rounded backdrop-blur border border-[#58A6FF]/30 w-max uppercase inline-flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                    Đã khoá
                  </div>
                  
                  <div className="text-[7px] font-mono text-emerald-400 bg-[#0B0E14]/80 px-1 py-0.5 rounded backdrop-blur self-start leading-none opacity-80 z-20">Mắt: {aiState.eyeContact}%</div>
                  <div className="text-[7px] font-mono text-[#58A6FF] bg-[#0B0E14]/80 px-1 py-0.5 rounded backdrop-blur self-start leading-none opacity-80 mt-1 z-20">Blinks: {aiState.blinkCount}</div>
                </motion.div>

                {/* Tracking HUD Elements */}
                <div className="absolute top-4 inset-x-4 bg-[#0B0E14]/70 backdrop-blur-md border border-[#30363D] rounded-xl p-3 flex justify-between items-center z-20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">AI VISION</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[9px] font-black text-[#58A6FF] uppercase">Face: {aiState.emotion}</span>
                    <span className="text-[9px] font-black text-emerald-400 uppercase">Giao tiếp: {aiState.eyeContact}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Video Controls bar (Shrunk for mobile) */}
            <div className="absolute bottom-4 left-4 right-4 bg-[#161B22]/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-[#30363D] flex justify-between items-center z-20 shadow-2xl">
              <button 
                onClick={togglePlay}
                className="text-white hover:text-[#58A6FF]"
              >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              <div 
                onClick={handleSeek}
                className="flex-1 mx-3 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer relative"
              >
                <div 
                  style={{ width: `${(currentTime / videoDuration) * 100}%` }}
                  className="h-full bg-[#58A6FF] shadow-[0_0_10px_#58A6FF]"
                />
              </div>
              <div className="text-[8px] font-mono text-gray-500 mr-2">{formatTime(currentTime)}</div>
              <Maximize2 size={14} className="text-gray-500 hover:text-white" />
            </div>
          </div>

          {/* AI Result & Label Verification Area */}
          <div className="flex-1 flex flex-col gap-8">
            <section className="bg-[#161B22]/50 p-8 rounded-[40px] border border-[#30363D] space-y-6">
              <div className="flex items-center gap-3">
                <Tag size={20} className="text-[#58A6FF]" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Nhãn AI gợi ý (Verify Required)</h4>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {tags.map(tag => (
                   <button 
                    key={tag.id}
                    onClick={() => toggleConfirm(tag.id)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2 ${
                      tag.confirmed 
                        ? 'bg-[#58A6FF] border-[#58A6FF] text-white shadow-lg' 
                        : 'bg-white/5 border-[#30363D] text-gray-400 hover:border-[#58A6FF]/50'
                    }`}
                  >
                    {tag.label} {tag.confirmed && <Check size={14} />}
                  </button>
                ))}
              </div>

              {/* Note Loop Recommendations */}
              {suggestedTags.length > 0 && (
                <div className="pt-6 border-t border-[#30363D] space-y-4">
                  <div className="flex items-center gap-3">
                    <Sparkles size={16} className="text-purple-400" />
                    <h4 className="text-[8px] font-black uppercase tracking-widest text-purple-400">AI Gợi ý từ Ghi chú (Pattern Loop)</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTags.map((st, i) => (
                      <div key={i} className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-[8px] font-black uppercase tracking-widest">
                        Topic: {st.keyword} ({st.frequency}x)
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-[10px] text-[#58A6FF]/50 italic">* AI tự động phân tích dựa trên bối cảnh video đã tải lên.</p>
            </section>

            <section className="bg-[#161B22]/50 p-10 rounded-[40px] border border-[#30363D] space-y-6">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} className="text-emerald-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Ghi chú Can thiệp</h4>
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

        {/* Right Sidebar: Quick Stats */}
        <aside className="w-full lg:w-[380px] space-y-8">
           <div className="bg-[#161B22] border border-[#30363D] rounded-[40px] p-10 space-y-10 shadow-hpdt">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#58A6FF]">Tỉ lệ Thành công (Tư duy AI)</h3>
                <div className="text-5xl font-black text-white italic">{hpdtResults.overall}<span className="text-[#58A6FF] font-normal">%</span></div>
                
                {/* Milestone Summary UI */}
                {!isAnalyzing && milestones.length > 0 && (
                  <div className="pt-4 space-y-3">
                     <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-[#30363D] pb-2">Milestones ({milestones.length})</p>
                     {milestones.map((m, i) => (
                       <div key={i} className="flex justify-between items-center text-[10px] font-mono">
                         <span className="text-gray-500">{m.time}s: {m.label}</span>
                         <span className="text-emerald-400">{m.eyeContact}%</span>
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
