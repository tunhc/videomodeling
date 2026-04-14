"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Play, ChevronRight, Video, CheckCircle2, Zap, Camera, MessageCircle, X, Loader2, Trash2, Calendar, Star, RefreshCw, Sparkles } from "lucide-react";
import HPDTBrainCard from "@/components/hpdt/HPDTBrainCard";
import ActivityItem from "@/components/parent/ActivityItem";
import VideoUploadModal from "@/components/VideoUploadModal";
import UserMenu from "@/components/layout/UserMenu";
import { subscribeToTasks, acknowledgeTask, CollaborationTask } from "@/lib/services/taskService";
import { videoService } from "@/lib/services/videoService";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { generateWeeklyScheduleAction } from "@/app/actions/gemini";
import { cloudinaryService } from "@/lib/services/cloudinaryService";
import { resolveLearnerForParent } from "@/lib/services/learnerService";

interface Activity {
  title: string;
  description: string;
  domain: string;
  requiresModeling: boolean;
}

export default function ParentHome() {
  const router = useRouter();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [tasks, setTasks] = useState<CollaborationTask[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [prevTaskCount, setPrevTaskCount] = useState(0);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [videoModelingSessions, setVideoModelingSessions] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [activeUploadTopic, setActiveUploadTopic] = useState("");

  const openVideoReplay = (video: { id: string; url?: string }) => {
    const url = typeof video.url === "string" ? video.url.trim() : "";
    const isAbsoluteUrl = /^https?:\/\//i.test(url);

    if (isAbsoluteUrl) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    // Fallback: avoid opening a relative/invalid URL that triggers Next.js 404.
    router.push(`/parent/analyze?id=${video.id}`);
  };

  // 1. Load User Profile
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    const userRole = localStorage.getItem("userRole") as any;

    if (!userId) {
      setLoadingVideos(false);
      setLoadingSchedule(false);
      return;
    }

    async function loadData() {
      try {
        const docRef = doc(db, "users", userId as string);
        const snap = await getDoc(docRef);
        let profile: any = null;
        
        if (snap.exists()) {
          profile = { id: snap.id, role: userRole, ...snap.data() };
        } else {
          profile = { id: userId, role: userRole, childId: (userId as string).replace("PH_", "") };
        }

        const learner = await resolveLearnerForParent(userId as string, profile?.childId);
        if (learner) {
          profile.childId = learner.id;
          profile.childName = learner.name;
          profile.displayName = `PH ${learner.name}`;
          profile.teacherId = learner.teacherId || profile.teacherId;
        }

        setUserProfile(profile);

        // Fetch Schedule
        if (profile && profile.childId) {
          const scheduleRef = doc(db, "weekly_schedules", profile.childId);
          const scheduleSnap = await getDoc(scheduleRef);
          if (scheduleSnap.exists()) {
            setWeeklySchedule(scheduleSnap.data().days || []);
          }
        }
      } catch (e) {
        console.error("Failed to load parent data:", e);
      } finally {
        setLoadingSchedule(false);
      }
    }
    loadData();
  }, []);

  // 2. Load Child Videos
  useEffect(() => {
    if (!userProfile) return;

    async function loadChildVideos() {
      setLoadingVideos(true);
      try {
        const list = await videoService.getRecentVideos({
          role: userProfile.role,
          userId: userProfile.id,
          childId: userProfile.childId
        });
        
        const formatted = list.map(v => {
          const safeUrl = typeof v.url === "string" ? v.url : "";
          // Cloudinary auto-poster trick: change extension to .jpg or inject so/0 for first frame
          const thumbnail = safeUrl.replace(/\.(mp4|mov|avi|wmv)$/, ".jpg");

          return {
            id: v.id,
            title: cloudinaryService.extractPublicIdFromUrl(safeUrl),
            location: v.context === "school" ? "Tại Trường" : "Tại Nhà",
            time: v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString("vi-VN") : "Gần đây",
            accuracy: v.status === "Đã phân tích" ? (v.hpdtAverages?.overall || 85) : 0,
            url: safeUrl,
            thumbnail: thumbnail,
            createdAt: v.createdAt
          };
        });
        setVideoModelingSessions(formatted);
      } catch (e) {
        console.error("Lỗi load video:", e);
      } finally {
        setLoadingVideos(false);
      }
    }
    loadChildVideos();
  }, [userProfile]);

  const handleGenerateWeeklyAI = async () => {
    if (!userProfile?.childId) return;
    setGeneratingWeekly(true);
    try {
      // 1. Get Child Stats
      const statsRef = doc(db, "hpdt_stats", userProfile.childId);
      const statsSnap = await getDoc(statsRef);
      const rawStats = statsSnap.exists() ? statsSnap.data() : { hpdt: userProfile.hpdt || 75 };
      const stats = JSON.parse(JSON.stringify(rawStats));
      
      // 2. Call AI
      const aiResponse = await generateWeeklyScheduleAction(stats, userProfile.displayName || "Bé");
      
      // 3. Parse JSON
      let parsedDays: any[] = [];
      try {
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedDays = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("AI Parse failed:", e);
      }

      if (parsedDays.length === 0) {
        // Mock Failover
        parsedDays = generateMockWeekly();
        setToastMessage("Đang sử dụng lộ trình mẫu do lỗi kết nối AI.");
        setShowToast(true);
      }

      // 4. Save to Firestore
      const scheduleRef = doc(db, "weekly_schedules", userProfile.childId);
      await setDoc(scheduleRef, {
        childId: userProfile.childId,
        days: parsedDays,
        updatedAt: new Date()
      });
      
      setWeeklySchedule(parsedDays);
    } catch (e) {
      console.error("Generate weekly failed:", e);
      // Mock Failover
      const mockDays = generateMockWeekly();
      setWeeklySchedule(mockDays);
      setToastMessage("Đang sử dụng lộ trình mẫu do lỗi kết nối AI.");
      setShowToast(true);
    } finally {
      setGeneratingWeekly(false);
    }
  };

  const generateMockWeekly = () => {
    const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
    return days.map(d => ({
      day: d,
      activities: [
        { title: "Giao tiếp mắt & Chào hỏi", description: "Bé nhìn vào mắt và vẫy tay khi được gọi tên.", domain: "Giao tiếp", requiresModeling: true },
        { title: "Vận động tinh: Gắp hạt", description: "Bé dùng kẹp gắp hạt đậu từ bát này sang bát kia.", domain: "Vận động", requiresModeling: false },
        { title: "Tự phục vụ: Cất dọn đồ chơi", description: "Bé tự tay cất đồ chơi vào thùng sau khi chơi xong.", domain: "Tự phục vụ", requiresModeling: true },
      ]
    }));
  };

  const handleDeleteVideo = async (vidId: string, createdAt: any) => {
    if (!confirm("Bạn có chắc chắn muốn xóa video này?")) return;
    try {
      const success = await videoService.deleteVideo(vidId, createdAt);
      if (success) {
        setVideoModelingSessions(prev => prev.filter(v => v.id !== vidId));
      } else {
        alert("Đã hết thời gian (1 giờ) để xóa video này.");
      }
    } catch (e) {
      console.error("Xóa thất bại:", e);
    }
  };

  useEffect(() => {
    if (!userProfile?.childId) return;
    
    const unsubscribe = subscribeToTasks(userProfile.childId, (newTasks) => {
      if (newTasks.length > prevTaskCount && prevTaskCount > 0) {
        setToastMessage(newTasks[newTasks.length - 1].content);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
      setPrevTaskCount(newTasks.length);
      setTasks(newTasks);
    });

    return () => unsubscribe();
  }, [userProfile, prevTaskCount]);

  const handleAcknowledge = async (taskId: string) => {
    await acknowledgeTask(taskId);
  };

  const startUpload = (topic: string) => {
    setActiveUploadTopic(topic);
    setIsUploadOpen(true);
  };

  return (
    <div className="flex flex-col bg-calming-bg min-h-screen pb-32">
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="fixed top-6 left-4 right-4 z-[100] bg-amber-500 text-white rounded-[24px] p-5 shadow-2xl flex items-start gap-4"
          >
            <div className="p-2 bg-white/20 rounded-xl shrink-0">
              <MessageCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Lời nhắn từ Giáo viên</p>
               <p className="text-sm font-bold mt-1 leading-snug line-clamp-2">{toastMessage}</p>
            </div>
            <button onClick={() => setShowToast(false)} className="shrink-0 opacity-70 hover:opacity-100">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="px-4 sm:px-8 py-4 sm:py-8 flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <UserMenu userName={userProfile?.displayName || "Phụ huynh"} role={userProfile?.role || "parent"} />
        <div className="relative p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Bell size={24} className="text-gray-400" />
          {tasks.length > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          )}
        </div>
      </header>

      <main className="px-8 space-y-10 mt-6">
        <HPDTBrainCard value={userProfile?.hpdt || 75} status="Đang tiến hóa" emotion="Vui vẻ" lastUpdate="Vừa xong" />

        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-amber-50 border-2 border-amber-100 rounded-[40px] p-8 space-y-4 shadow-soft relative overflow-hidden"
          >
            <div className="flex items-center gap-3 text-amber-600">
              <MessageCircle size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest italic">Lời nhắn từ {task.teacherName}</h3>
            </div>
            <p className="text-lg font-black text-amber-950 tracking-tight italic">"{task.content}"</p>
            <button
              onClick={() => task.id && handleAcknowledge(task.id)}
              className="bg-white text-amber-600 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border border-amber-100 flex items-center gap-2"
            >
              <CheckCircle2 size={14} /> Đã nhận bài
            </button>
          </motion.div>
        ))}

        {/* Video Modeling Section */}
        <section className="space-y-6">
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
            <span className="text-red-500"><Video size={24} /></span> Video Modeling
          </h3>

          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2 min-h-[200px]">
            {loadingVideos ? (
              <div className="flex items-center justify-center w-full py-10"><Loader2 className="animate-spin text-primary" size={32} /></div>
            ) : videoModelingSessions.length === 0 ? (
              <div className="text-center w-full py-10 text-gray-400 font-medium">Chưa có video modeling nào được chia sẻ.</div>
            ) : (
              videoModelingSessions.map((video, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -4 }}
                  className="min-w-[300px] bg-white rounded-[32px] shadow-premium border border-gray-100 overflow-hidden relative"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteVideo(video.id, video.createdAt); }}
                    className="absolute top-4 right-4 z-20 p-2 bg-white/80 backdrop-blur-sm text-gray-400 hover:text-red-500 rounded-xl border border-gray-100 shadow-sm transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="relative aspect-video bg-gray-100 flex items-center justify-center group cursor-pointer"
                       onClick={() => openVideoReplay(video)}>
                    <img 
                      src={video.thumbnail} 
                      alt={video.title} 
                      className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      onError={(e) => { (e.target as any).src = 'https://images.unsplash.com/photo-1620070088567-cc7601662b24?auto=format&fit=crop&q=80&w=400'; }}
                    />
                    <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] text-white font-bold uppercase tracking-wider">
                      {video.location}
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center relative z-10"
                    >
                      <Play size={32} className="text-white fill-white ml-1" />
                    </motion.div>
                  </div>
                  <div className="p-6 space-y-4">
                    <h4 className="font-extrabold text-gray-900 text-lg line-clamp-1">{video.title}</h4>
                    <div className="flex justify-between items-center">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">AI: {video.accuracy}%</span>
                      <span className="text-[10px] text-gray-400 font-bold tracking-widest">{video.time}</span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>

        {/* Lộ trình tuần này */}
        <section className="space-y-8 pb-10">
          <div className="flex justify-between items-end">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
              <span className="text-yellow-500"><Zap size={24} fill="currentColor" /></span> Lộ trình tuần này
            </h3>
            <button 
              onClick={handleGenerateWeeklyAI}
              disabled={generatingWeekly}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 px-4 py-2 rounded-xl transition-all"
            >
              {generatingWeekly ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Làm mới cả tuần
            </button>
          </div>
          
          <div className="space-y-12">
            {loadingSchedule ? (
               <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : weeklySchedule.length > 0 ? (
              weeklySchedule.map((day, dIdx) => {
                const daysMap = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
                const isToday = day.day === daysMap[new Date().getDay()];
                
                return (
                  <div key={dIdx} className={`space-y-6 ${isToday ? 'bg-primary/5 -mx-4 sm:mx-0 px-4 sm:px-8 py-8 rounded-[32px] sm:rounded-[40px] border border-primary/10 shadow-sm ring-4 ring-primary/5' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black ${isToday ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100 shadow-sm'}`}>
                        <span className="text-[8px] uppercase tracking-tighter opacity-70">Thứ</span>
                        <span className="text-lg leading-none">{day.day.split(" ")[1] || "?"}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-lg font-black tracking-tight ${isToday ? 'text-primary' : 'text-gray-900'}`}>
                            {day.day}
                          </h4>
                          {isToday && <span className="bg-primary text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Hôm nay</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">3 bài tập can thiệp AI</p>
                      </div>
                    </div>

                    <div className="space-y-0 relative pl-4 border-l-2 border-dashed border-gray-100 ml-6">
                      {day.activities.map((item: any, idx: number) => (
                        <div key={idx} className="relative pb-8 last:pb-0">
                          {/* Timeline Dot */}
                          <div className={`absolute -left-[25px] top-6 w-4 h-4 rounded-full border-4 border-white shadow-sm z-10 ${isToday ? 'bg-primary' : 'bg-gray-200'}`} />
                          
                          <div className="space-y-2">
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 pl-2">
                                {idx === 0 ? "Buổi Sáng" : idx === 1 ? "Buổi Trưa" : "Buổi Chiều"}
                             </span>
                             <ActivityItem 
                                title={item.title} 
                                location={item.requiresModeling ? "Yêu cầu Video" : "Xem giáo án"} 
                                duration={item.domain} 
                                isCompleted={false}
                                onUpload={item.requiresModeling ? () => startUpload(item.title) : undefined}
                              />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-[40px] p-10 text-center border-2 border-dashed border-gray-100 space-y-6">
                 <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto">
                    <Calendar size={32} className="text-gray-200" />
                 </div>
                 <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Chưa có lịch dạy tuần này</p>
                    <p className="text-[10px] text-gray-300 font-medium italic">Bạn có muốn AI cá nhân hóa lộ trình 7 ngày cho bé không?</p>
                 </div>
                 <button 
                    onClick={handleGenerateWeeklyAI}
                    disabled={generatingWeekly}
                    className="bg-primary text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 mx-auto"
                 >
                    {generatingWeekly ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} fill="currentColor" />}
                    Tạo lộ trình tuần này (AI)
                 </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Upload Button */}
      <button
        onClick={() => startUpload("Hoạt động tự phát")}
        className="fixed bottom-28 right-8 w-16 h-16 bg-primary text-white rounded-[24px] shadow-hpdt flex items-center justify-center active:scale-110 transition-all z-40"
      >
        <Camera size={32} fill="currentColor" />
      </button>

      <VideoUploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        role="parent" 
        childId={userProfile?.childId}
        initialTopic={activeUploadTopic}
      />
    </div>
  );
}
