"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, ChevronRight, Brain, Target, Compass,
  Sparkles, Camera, CheckCircle2, Zap, ArrowRight,
  Clock, Save, Loader2, Plus, X
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { resolveLearnerForParent } from "@/lib/services/learnerService";
import { cloudinaryService } from "@/lib/services/cloudinaryService";
import VideoUploadModal from "@/components/VideoUploadModal";
import UserMenu from "@/components/layout/UserMenu";
import { Play, Trash2 } from "lucide-react";

export default function ParentHome() {
  const router = useRouter();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewingVideo, setViewingVideo] = useState<{ url: string; title: string } | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);
  const [savingStep, setSavingStep] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedExercises(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const saveStepProgress = async (stepId: string, isDone: boolean) => {
    if (!userProfile?.childId) return;
    setSavingStep(stepId);
    try {
      const logRef = doc(collection(db, "exercise_logs"), `${userProfile.childId}_${stepId}`);
      await setDoc(logRef, {
        childId: userProfile.childId,
        stepId,
        status: isDone ? "parent_done" : "pending",
        note: taskNotes[stepId] || "",
        updatedAt: new Date(),
        parentName: userProfile.displayName || "Phụ huynh",
      }, { merge: true });
      if (isDone) {
        setCompletedTasks(prev => prev.includes(stepId) ? prev : [...prev, stepId]);
      } else {
        setCompletedTasks(prev => prev.filter(s => s !== stepId));
      }
    } catch (e) {
      console.error("Failed to save step progress:", e);
    } finally {
      setSavingStep(null);
    }
  };

  const handleDeleteVideo = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc muốn xóa video này không?")) return;
    try {
      const videoRef = doc(db, "video_modeling", videoId);
      const videoSnap = await getDoc(videoRef);
      if (!videoSnap.exists()) return;
      const videoData = videoSnap.data();
      const createdAt = videoData.createdAt?.toDate() || new Date();
      const diffMs = new Date().getTime() - createdAt.getTime();
      if (diffMs > 3600000 && userProfile.role !== "admin") {
        alert("Chỉ có thể xóa video trong vòng 1 giờ sau khi tải lên.");
        return;
      }
      await deleteDoc(videoRef);
      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Xóa thất bại. Vui lòng thử lại.");
    }
  };

  // Load progress
  useEffect(() => {
    if (!userProfile?.childId) return;
    const loadProgress = async () => {
      try {
        const q = query(collection(db, "exercise_logs"), where("childId", "==", userProfile.childId));
        const snap = await getDocs(q);
        const completed: string[] = [];
        const notes: Record<string, string> = {};
        snap.forEach(d => {
          const data = d.data();
          if (data.status === "parent_done") completed.push(data.stepId);
          if (data.note) notes[data.stepId] = data.note;
        });
        setCompletedTasks(completed);
        setTaskNotes(notes);
      } catch (e) {
        console.error("Error loading progress:", e);
      }
    };
    loadProgress();
  }, [userProfile?.childId]);

  // Load main data
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) { setLoading(false); return; }

    async function loadData() {
      try {
        const docRef = doc(db, "users", userId as string);
        const snap = await getDoc(docRef);
        let profile: any = { id: userId };
        if (snap.exists()) profile = { ...profile, ...snap.data() };

        const learner = await resolveLearnerForParent(userId as string, profile?.childId);
        if (learner) {
          profile.childId = learner.id;
          profile.childName = learner.name;
          profile.childAvatar = learner.avatarUrl || "";
          profile.regulationLevel = "Ổn định";

          let finalScore = 75;
          const statsRef = doc(db, "hpdt_stats", learner.id);
          const statsSnap = await getDoc(statsRef);
          if (statsSnap.exists()) {
            finalScore = statsSnap.data().overallScore || statsSnap.data().overall || finalScore;
          } else {
            const statsQuery = query(collection(db, "hpdt_stats"), where("childId", "==", learner.id));
            const statsResult = await getDocs(statsQuery);
            if (!statsResult.empty) {
              const sData = statsResult.docs[0].data();
              finalScore = sData.overallScore || sData.overall || finalScore;
            }
          }
          if (finalScore === 75 && learner.hpdt) finalScore = learner.hpdt;
          profile.hpdt = finalScore;
        }
        setUserProfile(profile);

        // Analyses
        if (profile.childId) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const q = query(collection(db, "video_analysis"), where("childId", "==", profile.childId));
          const aSnap = await getDocs(q);
          const sevenDaysAgoTime = sevenDaysAgo.getTime();
          const analyses = aSnap.docs
            .map(d => d.data())
            .filter((a: any) => (a.createdAt?.toDate()?.getTime() || 0) >= sevenDaysAgoTime)
            .sort((a: any, b: any) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0));

          if (analyses.length > 0) {
            const tagCounts: Record<string, number> = {};
            const behaviorCounts: Record<string, number> = {};
            analyses.forEach((a: any) => {
              a.frameAnalysis?.tags?.forEach((tag: string) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
              const behavior = a.fullAnalysis?.summary?.dominantBehavior;
              if (behavior) behaviorCounts[behavior] = (behaviorCounts[behavior] || 0) + 1;
            });
            const topStrengths = Object.entries(tagCounts).sort(([, a], [, b]) => b - a).map(([tag]) => tag);
            const topChallenges = Object.entries(behaviorCounts).sort(([, a], [, b]) => b - a).map(([b]) => b);
            const latest = analyses[0];
            setLatestAnalysis({
              ...latest,
              aggregated: { strengths: topStrengths.slice(0, 2), challenges: topChallenges[0] || "Đang theo dõi", videoCount: analyses.length }
            });
            if (latest.fullAnalysis?.summary?.regulationLevel) {
              profile.regulationLevel = latest.fullAnalysis.summary.regulationLevel;
              setUserProfile({ ...profile });
            }
          }
        }

        // Videos
        if (profile.childId) {
          const vQuery = query(collection(db, "video_modeling"), where("childId", "==", profile.childId));
          const vSnap = await getDocs(vQuery);
          const vList = vSnap.docs
            .map(d => {
              const raw = d.data() as any;
              const videoUrl = raw.url ? cloudinaryService.deobfuscateUrl(raw.url) : "";
              const rawThumb = raw.thumbnail || "";
              const thumbDecoded = rawThumb ? cloudinaryService.deobfuscateUrl(rawThumb) : "";
              const thumbnail = thumbDecoded.startsWith("http")
                ? thumbDecoded
                : videoUrl.includes("cloudinary.com")
                  ? videoUrl.replace(/\.[^./?#]+(\?.*)?$/, ".jpg").replace("/video/upload/", "/video/upload/so_0/")
                  : "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&q=80&w=400";
              return { id: d.id, ...raw, thumbnail, videoUrl };
            })
            .sort((a: any, b: any) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0))
            .slice(0, 10);
          setVideos(vList);
        }
      } catch (e) {
        console.error("Failed to load parent data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const today = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const strengths = latestAnalysis?.aggregated?.strengths || ["Giao tiếp mắt"];
  const strengthsDesc = latestAnalysis?.frameAnalysis?.summary?.substring(0, 50) || "Duy trì tốt hơn trong các trò chơi vận động.";
  const challenges = latestAnalysis?.aggregated?.challenges || "Âm thanh lớn";
  const challengesDesc = "Dễ bị choáng ngợp bởi tiếng ồn môi trường xung quanh.";
  const videoCount = latestAnalysis?.aggregated?.videoCount || 0;
  const aiAdvice = latestAnalysis?.fullAnalysis?.summary?.overallRecommendation
    || latestAnalysis?.reportContent?.clinicalNote
    || `Dựa trên dữ liệu hôm nay, ${userProfile?.childName || "bé"} có xu hướng nhạy cảm với âm thanh. Hãy chuẩn bị tai nghe chống ồn khi đi dạo vào buổi chiều.`;
  const goals = latestAnalysis?.reportContent?.monthlyPlan?.slice(0, 2) || [
    { period: "Tháng 4", focus: "Mở rộng vốn từ vựng về chủ đề động vật yêu thích", domain: "GIAO TIẾP" },
    { period: "Tháng 4", focus: "Nâng cao khả năng tương tác và chơi luân phiên", domain: "XÃ HỘI" },
  ];
  const activities = latestAnalysis?.reportContent?.exercises?.slice(0, 2) || [
    { title: "Vẽ tranh bằng ngón tay", time: "15 phút", category: "Phát triển xúc giác" },
    { title: "Ghép hình khối cơ bản", time: "10 phút", category: "Tư duy logic" },
  ];

  const getAnalysisProgress = (video: any) => {
    if (video.status === "analyzed" || video.status === "Đã phân tích") return 100;
    if (video.createdAt) {
      const elapsed = (Date.now() - (video.createdAt?.toDate?.()?.getTime() || Date.now())) / 1000;
      if (elapsed < 60) return Math.min(95, Math.floor((elapsed / 60) * 85));
      return 95;
    }
    return 0;
  };

  return (
    <div className="flex flex-col bg-[#F8FAFC] min-h-screen pb-32">
      {/* Header */}
      <header className="px-6 py-6 flex justify-between items-center bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <UserMenu userName={userProfile?.displayName || "Phụ huynh"} role="parent" />
        </div>
        <h1 className="text-lg font-bold text-slate-800">Trang chủ Phụ huynh</h1>
        <div className="relative w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
        </div>
      </header>

      <main className="px-6 pt-8 space-y-10">
        {/* Profile */}
        <section className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-200">
              <img
                src={userProfile?.childAvatar || "https://images.unsplash.com/photo-1502086223501-7ea2443d8447?auto=format&fit=crop&q=80&w=200"}
                alt="Child"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white shadow-sm" />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Chào ba mẹ!</h2>
            <p className="text-slate-500 font-medium text-lg mt-0.5">
              {userProfile?.childName || "Bé"} đang cảm thấy{" "}
              <span className="text-indigo-600 font-bold">{userProfile?.regulationLevel || "ổn định"}</span>
            </p>
            <p className="text-orange-500 font-bold text-sm mt-1 uppercase tracking-wider">{today}</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến độ HPDT</span>
            <div className="text-3xl font-black text-indigo-600 leading-none">{userProfile?.hpdt || 75}%</div>
          </div>
        </section>

        {/* HPDT Card */}
        <section className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-indigo-50 rounded-full opacity-50" />
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-20 h-20 bg-indigo-600 rounded-[24px] flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Brain size={40} fill="currentColor" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 leading-tight">Chỉ số HPDT</h3>
              <p className="text-slate-500 font-medium">Bé đang tiến hóa tích cực</p>
            </div>
          </div>
          <div className="relative z-10 text-right">
            <div className="text-5xl font-black text-indigo-600 leading-none tracking-tighter">
              {userProfile?.hpdt || 75}<span className="text-2xl opacity-50">%</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2">
              <Zap size={10} fill="currentColor" /> +2.5% tuần này
            </div>
          </div>
        </section>

        {/* Characteristics Summary */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Tóm tắt đặc điểm</h3>
            {videoCount > 0 && (
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full border border-indigo-100">
                Dựa trên {videoCount} video tuần này
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <motion.div whileHover={{ y: -4 }} className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 space-y-3">
              <span className="inline-block bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Thế mạnh</span>
              <h4 className="font-bold text-slate-900 text-lg">{strengths[0]}</h4>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">{strengthsDesc}</p>
            </motion.div>
            <motion.div whileHover={{ y: -4 }} className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 space-y-3">
              <span className="inline-block bg-rose-50 text-rose-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Thách thức</span>
              <h4 className="font-bold text-slate-900 text-lg">{challenges}</h4>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">{challengesDesc}</p>
            </motion.div>
          </div>
        </section>

        {/* AI Advice */}
        <section className="bg-orange-50 rounded-[32px] p-8 space-y-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-orange-100 rounded-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-200">
              <Brain size={24} fill="currentColor" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Lời khuyên từ AI</h3>
          </div>
          <p className="text-slate-700 font-medium leading-relaxed text-lg relative z-10">{aiAdvice}</p>
          <button
            onClick={() => router.push("/parent/library")}
            className="flex items-center gap-2 text-orange-600 font-bold text-sm group/btn relative z-10"
          >
            Xem chi tiết phân tích <ArrowRight size={16} className="transition-transform group-hover/btn:translate-x-1" />
          </button>
        </section>

        {/* Suggested Goals */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Target size={16} className="text-orange-500" /> Mục tiêu phát triển gợi ý (AI)
            </h3>
            <button className="text-orange-500 font-bold text-sm">Làm mới</button>
          </div>
          <div className="space-y-4">
            {goals.map((goal: any, idx: number) => (
              <div key={idx} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-50 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                  <Compass size={24} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 leading-tight pr-4">{goal.focus}</h4>
                    <span className="shrink-0 bg-orange-50 text-orange-600 text-[10px] font-black px-3 py-1 rounded-full">
                      {goal.domain || "XÃ HỘI"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <Clock size={10} /> {goal.period || "Tháng này"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Video Modeling ─────────────────────────────────────────── */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Camera className="text-rose-500" size={22} /> Video Modeling
            </h3>
            <div className="flex items-center gap-2">
              {videos.length > 0 && (
                <button
                  onClick={() => router.push("/parent/library")}
                  className="text-indigo-600 font-bold text-sm"
                >
                  Xem tất cả
                </button>
              )}
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-rose-600 transition-all active:scale-95"
              >
                <Plus size={14} strokeWidth={3} /> Upload
              </button>
            </div>
          </div>

          <div className="flex gap-5 overflow-x-auto pb-4 -mx-6 px-6 no-scrollbar snap-x">
            {videos.length > 0 ? videos.map((video: any, idx: number) => {
              const progress = getAnalysisProgress(video);
              const createdAt = video.createdAt?.toDate?.() || new Date();
              const timeStr = createdAt.toLocaleTimeString("vi-VN", { hour12: false, hour: "2-digit", minute: "2-digit" });
              const dateStr = createdAt.toLocaleDateString("vi-VN");
              const isAnalyzed = progress === 100;

              return (
                <motion.div
                  key={video.id || idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="min-w-[280px] bg-white rounded-[28px] overflow-hidden border border-slate-100 shadow-sm snap-start group cursor-pointer flex-shrink-0"
                  onClick={() => {
                    if (isAnalyzed) {
                      setViewingVideo({ url: video.videoUrl || video.url || "", title: video.topic || `Video ${idx + 1}` });
                    } else {
                      router.push(`/parent/analyze?id=${video.id}`);
                    }
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative h-44 bg-slate-900">
                    <img
                      src={video.thumbnail || "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&q=80&w=400"}
                      className="w-full h-full object-cover opacity-80"
                      alt="Thumbnail"
                    />
                    <div className="absolute inset-0 p-3 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">
                          {video.context === "home" ? "Tại nhà" : (video.context || "Lớp học")}
                        </span>
                        <button
                          onClick={(e) => handleDeleteVideo(video.id, e)}
                          className="w-7 h-7 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white transition-all shadow-sm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex justify-center items-center">
                        <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white group-hover:scale-110 transition-transform">
                          <Play fill="white" size={20} className="ml-0.5" />
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className={`h-full rounded-full ${isAnalyzed ? "bg-emerald-400" : "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-3">
                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1">
                      {video.topic || video.fileName || `Video ${idx + 1}`}
                    </h4>
                    <div className="flex items-center justify-between">
                      <div className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 ${isAnalyzed ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isAnalyzed ? "bg-emerald-500" : "bg-indigo-500 animate-pulse"}`} />
                        {isAnalyzed ? "Đã phân tích" : `AI: ${progress}%`}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold tabular-nums">{timeStr} · {dateStr}</span>
                    </div>
                  </div>
                </motion.div>
              );
            }) : (
              /* Empty state */
              <div className="w-full min-w-[calc(100vw-3rem)] py-14 flex flex-col items-center justify-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 rounded-[28px] bg-rose-50 flex items-center justify-center mb-4">
                  <Camera size={36} className="text-rose-200" />
                </div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Chưa có video nào</p>
                <p className="text-xs text-slate-300 font-medium mb-6 text-center">Ba mẹ hãy quay video bé để AI phân tích hành vi</p>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="flex items-center gap-2 px-7 py-3 bg-rose-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-600 transition-all shadow-sm active:scale-95"
                >
                  <Camera size={14} /> Tải lên video đầu tiên
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Intervention Plan */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Target size={18} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Kế hoạch can thiệp</h3>
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2 py-1 rounded-full border border-indigo-100">
                {activities.length} bài học
              </span>
            </div>
            <div className="flex items-center gap-2">
              {["ABA", "OT", "DIR/Floortime"].map(t => (
                <span key={t} className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-lg uppercase">{t}</span>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {activities.map((act: any, idx: number) => {
              const exerciseId = act.title || `ex-${idx}`;
              const isExpanded = expandedExercises.includes(exerciseId);
              const steps = act.steps || [
                "Quan sát và tham gia theo sự dẫn dắt của trẻ",
                "Mở rộng vòng tròn giao tiếp",
                "Tạo cơ hội cho bé khởi xướng",
              ];
              const completedCount = steps.filter((s: string) => completedTasks.includes(`${exerciseId}-${s}`)).length;

              return (
                <motion.div key={exerciseId} layout className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                  <div onClick={() => toggleExpand(exerciseId)} className="p-8 cursor-pointer hover:bg-slate-50 transition-all">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-start gap-6 flex-1">
                        <div className="w-12 h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-100 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xl font-black text-slate-900 leading-tight">
                              {act.title || "Tăng cường Tương tác"}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-black text-sm">{completedCount}/{steps.length}</span>
                              <ChevronRight size={20} className={`text-slate-300 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-lg uppercase">
                              {act.category || act.domain || "Social Skill"}
                            </span>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase ${
                              idx % 3 === 0 ? "bg-orange-50 text-orange-600" :
                              idx % 3 === 1 ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                            }`}>
                              {idx % 3 === 0 ? "Cả hai" : idx % 3 === 1 ? "Giáo viên" : "Phụ huynh"}
                            </span>
                          </div>
                          <p className="text-slate-500 font-medium leading-relaxed">
                            {act.objective || act.focus || "Nhấn để xem các bước thực hiện chi tiết."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-50"
                      >
                        <div className="p-8 bg-slate-50/50 space-y-8">
                          <div className="flex items-center gap-2 text-indigo-600">
                            <Sparkles size={16} />
                            <h5 className="text-xs font-black uppercase tracking-widest">Các bước thực hiện</h5>
                          </div>
                          <div className="space-y-10">
                            {steps.map((step: string, sIdx: number) => {
                              const stepId = `${exerciseId}-${step}`;
                              const isStepDone = completedTasks.includes(stepId);
                              const isSaving = savingStep === stepId;
                              return (
                                <div key={sIdx} className="flex gap-6 group">
                                  <button
                                    onClick={() => saveStepProgress(stepId, !isStepDone)}
                                    disabled={isSaving}
                                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                      isStepDone ? "bg-emerald-500 border-emerald-500 text-white" : "bg-indigo-50 border-indigo-100 text-indigo-400 group-hover:border-indigo-300"
                                    } ${isSaving ? "animate-pulse" : ""}`}
                                  >
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> :
                                     isStepDone ? <CheckCircle2 size={20} /> : <span className="text-sm font-black">{sIdx + 1}</span>}
                                  </button>
                                  <div className="space-y-4 flex-1">
                                    <div className="space-y-2">
                                      <h6 className={`text-lg font-bold leading-tight transition-colors ${isStepDone ? "text-slate-400 line-through" : "text-slate-900"}`}>
                                        {step}
                                      </h6>
                                      {!isStepDone && (
                                        <div className="space-y-2">
                                          <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                            Cho phép bé lựa chọn hoạt động chơi tự do. Quan sát hành vi và sự chú ý của trẻ.
                                          </p>
                                          <p className="text-xs font-bold text-indigo-500 leading-relaxed italic">
                                            HD: Ngồi gần bé, bắt chước hành động chơi của trẻ.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    <div className="relative group/note">
                                      <textarea
                                        value={taskNotes[stepId] || ""}
                                        onChange={(e) => setTaskNotes(prev => ({ ...prev, [stepId]: e.target.value }))}
                                        placeholder="Ghi chú kết quả cho bước này..."
                                        className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-3 text-xs font-medium focus:ring-2 focus:ring-indigo-100 transition-all min-h-[60px] resize-none"
                                      />
                                      <button
                                        onClick={() => saveStepProgress(stepId, isStepDone)}
                                        disabled={isSaving}
                                        className="absolute right-3 bottom-3 p-2 bg-indigo-50 text-indigo-600 rounded-lg opacity-0 group-hover/note:opacity-100 transition-opacity hover:bg-indigo-600 hover:text-white"
                                      >
                                        {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                      </button>
                                    </div>
                                    {!isStepDone && (
                                      <p className="text-xs font-bold text-emerald-500 leading-relaxed">
                                        Mục tiêu: Bé phản hồi bằng cách nhìn, cười, hoặc tiếp tục chơi.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsUploadOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#5851DB] text-white rounded-2xl shadow-2xl shadow-indigo-200 flex items-center justify-center active:scale-110 transition-all z-50 group overflow-hidden border-4 border-white/20"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Camera size={28} strokeWidth={2.5} />
      </motion.button>

      <VideoUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        role="parent"
        childId={userProfile?.childId}
      />

      {/* Video viewer modal */}
      <AnimatePresence>
        {viewingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex flex-col"
            onClick={() => setViewingVideo(null)}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
              <p className="text-white font-bold text-sm truncate pr-4">{viewingVideo.title}</p>
              <button
                onClick={() => setViewingVideo(null)}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Video */}
            <div className="flex-1 flex items-center justify-center px-4 pb-8" onClick={e => e.stopPropagation()}>
              {viewingVideo.url ? (
                <video
                  src={viewingVideo.url}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-full rounded-2xl"
                  style={{ maxHeight: "calc(100vh - 100px)" }}
                />
              ) : (
                <div className="text-white/50 text-sm font-bold">Không tải được video.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
