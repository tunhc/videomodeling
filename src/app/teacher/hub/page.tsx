"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ChevronRight, Video, Play, Trash2,
  X, CheckCircle2, Clock, BarChart2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { videoService } from "@/lib/services/videoService";
import { cloudinaryService } from "@/lib/services/cloudinaryService";

export default function TeacherHub() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingVideo, setViewingVideo] = useState<any>(null);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isAnalyzed = (status: string) =>
    status === "analyzed" || status === "Đã phân tích";

  useEffect(() => {
    async function loadVideos() {
      setLoading(true);
      try {
        const userId = localStorage.getItem("userId") || "";
        const userRole = localStorage.getItem("userRole") as any;

        const list = await videoService.getRecentVideos({ role: userRole, userId });

        const formattedList = list.map(vid => {
          const rawUrl = typeof vid.url === "string"
            ? cloudinaryService.deobfuscateUrl(vid.url)
            : vid.url;
          const rawThumb = typeof vid.thumbnail === "string"
            ? cloudinaryService.deobfuscateUrl(vid.thumbnail)
            : vid.thumbnail;

          return {
            ...vid,
            url: rawUrl,
            thumbnail: rawThumb || (() => {
              try {
                const publicId = cloudinaryService.extractPublicIdFromUrl(rawUrl);
                return publicId
                  ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload/so_0/${publicId}.jpg`
                  : null;
              } catch { return null; }
            })(),
            title: vid.topic || vid.lesson || cloudinaryService.extractPublicIdFromUrl(vid.url),
            sender: vid.senderId || "Hệ thống",
            date: new Date(vid.createdAt?.toDate?.() || Date.now()).toLocaleString("vi-VN"),
            type: vid.context === "school" ? "School" : "Home",
          };
        });
        setVideos(formattedList);
      } catch (error) {
        console.error("Lỗi load videos:", error);
      } finally {
        setLoading(false);
      }
    }
    loadVideos();
  }, []);

  const handleVideoClick = (vid: any) => {
    if (isAnalyzed(vid.status)) {
      setViewingVideo(vid);
    } else {
      router.push(`/teacher/analyze?id=${vid.id}`);
    }
  };

  const handleDeleteVideo = async (e: React.MouseEvent, vidId: string, createdAt: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Bạn có chắc chắn muốn xóa video này?")) return;
    try {
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
      </header>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Video size={20} className="text-primary" />
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Danh sách Video</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center p-8 text-gray-400">Chưa có video nào.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {videos.map((vid) => {
              const createdDate = vid.createdAt?.toDate
                ? vid.createdAt.toDate()
                : (vid.createdAt instanceof Date ? vid.createdAt : new Date());
              const canDelete = isNaN(createdDate.getTime()) ||
                (new Date().getTime() - createdDate.getTime()) < 3600000;
              const analyzed = isAnalyzed(vid.status);

              return (
                <motion.div
                  key={vid.id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={() => handleVideoClick(vid)}
                  className="bg-white rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 border border-gray-50 shadow-soft hover:shadow-premium transition-all group flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 cursor-pointer relative"
                >
                  {/* Thumbnail */}
                  <div className="w-32 h-20 bg-gray-100 rounded-2xl flex items-center justify-center relative overflow-hidden shrink-0">
                    {vid.thumbnail ? (
                      <img src={vid.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : vid.url ? (
                      <video src={vid.url} className="absolute inset-0 w-full h-full object-cover opacity-50 blur-[2px]" />
                    ) : null}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      {analyzed ? (
                        <CheckCircle2 size={24} className="text-emerald-400" />
                      ) : (
                        <Play size={24} className="text-white group-hover:text-primary transition-colors" />
                      )}
                    </div>
                    <span className="absolute bottom-2 right-2 text-[8px] font-black text-white bg-black/50 px-2 py-0.5 rounded-full z-10">
                      {vid.duration ? formatTime(vid.duration) : "0:00"}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-2 w-full min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${vid.type === "Home" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
                        {vid.type === "Home" ? "Tại nhà" : "Tại trường"}
                      </span>
                      <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest italic">{vid.date}</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-tight line-clamp-2 sm:line-clamp-1">
                      {vid.title}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">
                      {getChildName(vid.childId)} • {vid.role === "teacher" ? "Giáo viên" : "Phụ huynh"}
                    </p>
                    {/* Action hint */}
                    <p className={`text-[10px] font-black uppercase tracking-widest ${analyzed ? "text-emerald-500" : "text-indigo-400"}`}>
                      {analyzed ? "Nhấn để xem lại video" : "Nhấn để bắt đầu phân tích AI →"}
                    </p>
                  </div>

                  {/* Status + actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto text-right space-y-0 sm:space-y-3 pt-2 sm:pt-0 border-t sm:border-0 border-gray-50">
                    <div className="flex items-center gap-2">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteVideo(e, vid.id, vid.createdAt)}
                          className="p-3 text-gray-400 hover:text-red-500 transition-all rounded-full hover:bg-red-50 relative z-50"
                          title="Xóa video"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      <span className={`flex items-center gap-1.5 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${
                        analyzed
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-indigo-50 text-primary"
                      }`}>
                        {analyzed
                          ? <><CheckCircle2 size={12} /> Đã phân tích</>
                          : <><Clock size={12} /> Chờ phân tích</>
                        }
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

      {/* View-only modal for analyzed videos */}
      <AnimatePresence>
        {viewingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
            onClick={() => setViewingVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl bg-black rounded-[32px] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gray-900">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Xem lại video</p>
                  <h3 className="text-sm font-black text-white truncate max-w-xs">{viewingVideo.title}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setViewingVideo(null); router.push(`/teacher/analyze?id=${viewingVideo.id}`); }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                  >
                    <BarChart2 size={14} /> Xem phân tích
                  </button>
                  <button
                    onClick={() => setViewingVideo(null)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Video player */}
              <video
                src={viewingVideo.url}
                controls
                autoPlay
                className="w-full max-h-[70vh] bg-black"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
