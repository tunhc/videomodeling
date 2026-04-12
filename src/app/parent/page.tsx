"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Play, ChevronRight, Video, CheckCircle2, Zap, Camera, MessageCircle, X, Loader2, Trash2, Calendar, Star } from "lucide-react";
import HPDTBrainCard from "@/components/hpdt/HPDTBrainCard";
import ActivityItem from "@/components/parent/ActivityItem";
import VideoUploadModal from "@/components/VideoUploadModal";
import UserMenu from "@/components/layout/UserMenu";
import { subscribeToTasks, acknowledgeTask, CollaborationTask } from "@/lib/services/taskService";
import { videoService } from "@/lib/services/videoService";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface Activity {
  title: string;
  description: string;
  domain: string;
  requiresModeling: boolean;
}

export default function ParentHome() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [tasks, setTasks] = useState<CollaborationTask[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [prevTaskCount, setPrevTaskCount] = useState(0);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [videoModelingSessions, setVideoModelingSessions] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [activeUploadTopic, setActiveUploadTopic] = useState("");

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
        let profile = null;
        
        if (snap.exists()) {
          profile = { id: snap.id, role: userRole, ...snap.data() };
        } else {
          profile = { id: userId, role: userRole, childId: (userId as string).replace("PH_", "") };
        }
        setUserProfile(profile);

        // Fetch Schedule
        if (profile.childId) {
          const scheduleRef = doc(db, "weekly_schedules", profile.childId);
          const scheduleSnap = await getDoc(scheduleRef);
          if (scheduleSnap.exists()) {
            const days = scheduleSnap.data().days || [];
            const daysMap = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
            const todayStr = daysMap[new Date().getDay()];
            const todayData = days.find((d: any) => d.day === todayStr);
            if (todayData) setTodayActivities(todayData.activities || []);
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
          // Cloudinary auto-poster trick: change extension to .jpg or inject so/0 for first frame
          const thumbnail = v.url.replace(/\.(mp4|mov|avi|wmv)$/, ".jpg");

          return {
            id: v.id,
            title: v.topic || "Hoạt động Video Modeling",
            location: v.context === "school" ? "Tại Trường" : "Tại Nhà",
            time: v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString("vi-VN") : "Gần đây",
            accuracy: v.status === "Đã phân tích" ? (v.hpdtAverages?.overall || 85) : 0,
            url: v.url,
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

      <header className="p-8 pt-12 flex justify-between items-start bg-white/50 backdrop-blur-md sticky top-0 z-40">
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
                       onClick={() => window.open(video.url, '_blank')}>
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

        {/* Lộ trình hôm nay - SYNC with Teacher Schedule */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
              <span className="text-yellow-500"><Zap size={24} fill="currentColor" /></span> Lộ trình hôm nay
            </h3>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pb-1 border-b italic">
               {new Date().toLocaleDateString('vi-VN')}
            </span>
          </div>
          
          <div className="space-y-4">
            {loadingSchedule ? (
               <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : todayActivities.length > 0 ? (
              todayActivities.map((item, idx) => (
                <ActivityItem 
                  key={idx} 
                  title={item.title} 
                  location={item.requiresModeling ? "Yêu cầu Video" : "Xem giáo án"} 
                  duration={item.domain} 
                  isCompleted={false}
                  onUpload={item.requiresModeling ? () => startUpload(item.title) : undefined}
                />
              ))
            ) : (
              <div className="bg-gray-50 rounded-[40px] p-10 text-center border-2 border-dashed border-gray-100">
                 <Calendar size={32} className="text-gray-200 mx-auto mb-4" />
                 <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Chưa có lịch dạy từ giáo viên tuần này.</p>
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
