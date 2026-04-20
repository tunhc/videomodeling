"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Loader2, Tag, ChevronRight, Video, Play, Trash2
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { videoService } from "@/lib/services/videoService";
import { cloudinaryService } from "@/lib/services/cloudinaryService";

export default function TeacherHub() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    async function loadVideos() {
      setLoading(true);
      try {
        const userId = localStorage.getItem("userId") || "";
        const userRole = localStorage.getItem("userRole") as any;

        const list = await videoService.getRecentVideos({
          role: userRole,
          userId: userId
        });

        const formattedList = list.map(vid => ({
          ...vid,
          title: cloudinaryService.extractPublicIdFromUrl(vid.url),
          sender: vid.senderId || "Hệ thống",
          date: new Date(vid.createdAt?.toDate() || Date.now()).toLocaleString("vi-VN"),
          type: vid.context === "school" ? "School" : "Home"
        }));
        setVideos(formattedList);
      } catch (error) {
        console.error("Lỗi load videos:", error);
      } finally {
        setLoading(false);
      }
    }
    loadVideos();
  }, []);

  const handleDeleteVideo = async (vidId: string, createdAt: any) => {
    if (!confirm("Bạn có chắc chắn muốn xóa video này?")) return;
    try {
      console.log("Attempting to delete video:", vidId);
      const success = await videoService.deleteVideo(vidId, createdAt);
      if (success) {
        setVideos(prev => prev.filter(v => v.id !== vidId));
      } else {
        alert("Đã hết thời gian (1 giờ) để xóa video này.");
      }
    } catch (e) {
      console.error("Xóa thất bại:", e);
      alert("Lỗi hệ thống khi xóa. Vui lòng thử lại.");
    }
  };

  const getChildName = (childId: string) => {
    if (childId === "minh-khoi") return "Minh Khôi";
    if (childId === "KBC-HCM_Long_B01") return "Long";
    return childId;
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-4 sm:-mx-8 px-4 sm:px-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Trung tâm Phân tích</h1>
          <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Video Modeling & Can thiệp</p>
        </div>
        {/* Removing Upload Modeling Button as requested */}
      </header>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Video size={20} className="text-primary" />
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Danh sách Video chờ phân tích</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : videos.length === 0 ? (
          <div className="text-center p-8 text-gray-400">Chưa có video nào. Hãy tải lên hoặc quay mới.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {videos.map((vid) => {
              const createdDate = vid.createdAt?.toDate ? vid.createdAt.toDate() : (vid.createdAt instanceof Date ? vid.createdAt : new Date());
              const canDelete = isNaN(createdDate.getTime()) || (new Date().getTime() - createdDate.getTime()) < 3600000;

              return (
                <motion.div 
                  key={vid.id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 border border-gray-50 shadow-soft hover:shadow-premium transition-all group flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 cursor-pointer relative"
                >
                  <div 
                    onClick={() => router.push(`/teacher/analyze?id=${vid.id}`)}
                    className="w-32 h-20 bg-gray-100 rounded-2xl flex items-center justify-center relative overflow-hidden shrink-0"
                  >
                    {vid.url ? (
                       <video src={vid.url} className="absolute inset-0 w-full h-full object-cover opacity-50 blur-[2px]" />
                    ) : null}
                    <Play size={24} className="text-gray-900 group-hover:text-primary transition-colors absolute z-10" />
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity z-0" />
                    <span className="absolute bottom-2 right-2 text-[8px] font-black text-white bg-black/50 px-2 py-0.5 rounded-full z-10">
                      {vid.duration ? formatTime(vid.duration) : "0:00"}
                    </span>
                  </div>
                  
                  <div 
                    onClick={() => router.push(`/teacher/analyze?id=${vid.id}`)}
                    className="flex-1 space-y-2 w-full min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${vid.type === 'Home' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                        {vid.type === 'Home' ? 'Tại nhà' : 'Tại trường'}
                      </span>
                      <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest italic">{vid.date}</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-tight line-clamp-2 sm:line-clamp-1">{vid.title}</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">
                      {getChildName(vid.childId)} • {vid.role === 'teacher' ? 'Giáo viên' : 'Phụ huynh'}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto text-right space-y-0 sm:space-y-3 pt-2 sm:pt-0 border-t sm:border-0 border-gray-50">
                    <div className="flex gap-2">
                      {canDelete && (
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            handleDeleteVideo(vid.id, vid.createdAt); 
                          }}
                          className="p-3 text-gray-400 hover:text-red-500 transition-all rounded-full hover:bg-red-50 relative z-50"
                          title="Xóa video"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${vid.status === 'Đã phân tích' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-primary'}`}>
                        {vid.status}
                      </span>
                    </div>
                    <div className="pr-2">
                      <ChevronRight size={20} className="text-gray-200 group-hover:text-primary" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
