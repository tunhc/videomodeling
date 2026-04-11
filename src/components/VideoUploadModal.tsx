import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, CheckCircle2, Loader2, Sparkles, ChevronRight, Video, Home, Building2, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { videoService } from "@/lib/services/videoService";
import { cloudinaryService } from "@/lib/services/cloudinaryService";

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: "parent" | "teacher";
  initialChildId?: string | null;
  initialTopic?: string;
}

export default function VideoUploadModal({ isOpen, onClose, role, initialChildId, initialTopic }: VideoUploadModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "processing" | "labeling" | "context" | "success">("upload");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [context, setContext] = useState<"Home" | "School" | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const emotions = ["Vui vẻ", "Bình thường", "Căng thẳng", "Khóc/Quấy", "Kích động", "Sợ hãi"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideo(file);
      setStep("labeling");
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStep("upload");
    setUploadProgress(0);
  };

  const handleContextSelect = (ctx: "Home" | "School") => {
    setContext(ctx);
    handleFinish(ctx);
  };

  const handleFinish = async (currentContext: "Home" | "School") => {
    if (!video) return;
    
    setStep("processing"); 
    setUploadProgress(0);
    abortControllerRef.current = new AbortController();
    
    try {
      // 1. Extract duration
      const duration = await new Promise<number>((resolve) => {
        const tempVideo = document.createElement("video");
        tempVideo.preload = "metadata";
        tempVideo.src = URL.createObjectURL(video);
        
        tempVideo.onloadedmetadata = () => {
          if (tempVideo.duration > 0) {
             resolve(tempVideo.duration);
             URL.revokeObjectURL(tempVideo.src);
          }
        };

        tempVideo.onloadeddata = () => {
          if (tempVideo.duration > 0) {
             resolve(tempVideo.duration);
             URL.revokeObjectURL(tempVideo.src);
          }
        };

        setTimeout(() => {
          if (tempVideo.duration > 0) resolve(tempVideo.duration);
          else resolve(0);
        }, 3000);
      });

      const activeChildId = initialChildId || "KBC-HCM_Long_B01";
      const finalTopic = initialTopic || video.name;

      // 2. Upload to Cloudinary
      const cloudinaryResult = await cloudinaryService.uploadVideo(
        video,
        (progress) => setUploadProgress(progress),
        abortControllerRef.current
      );

      // 3. Register Metadata in Firebase
      const newVideo = await videoService.registerVideoMetadata(
        cloudinaryResult.secureUrl, 
        activeChildId,
        selectedEmotions[0] || "General", 
        { 
          allTags: selectedEmotions,
          context: currentContext === "School" ? "school" : "home",
          topic: finalTopic,
          duration: Math.round(duration)
        },
        role
      );
      
      setStep("success");
      
      setTimeout(() => {
        onClose();
        resetModal();
        if (newVideo?.id) {
          const analyzePath = role === "parent" ? "/parent/analyze" : "/teacher/analyze";
          router.push(`${analyzePath}?id=${newVideo.id}`);
        } else {
          // Fallback if ID is mysteriously missing
          const target = role === "parent" ? "/parent" : "/teacher/hub";
          router.push(target);
        }
      }, 1500);
    } catch (error: any) {
      if (error.message === "Upload canceled") {
        console.log("Upload canceled by user");
      } else {
        console.error("Upload failed:", error);
        alert("Lỗi tải lên: " + error.message);
        setStep("upload");
      }
    }
  };

  const resetModal = () => {
    setStep("upload");
    setVideo(null);
    setSelectedEmotions([]);
    setContext(null);
    setUploadProgress(0);
    abortControllerRef.current = null;
  };

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions(prev => 
      prev.includes(emotion) ? prev.filter(e => e !== emotion) : [...prev, emotion]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] p-10 space-y-8 shadow-2xl overflow-hidden relative"
      >
        <button onClick={() => { if(step === 'upload' || step === 'success') onClose(); else handleCancelUpload(); }} className="absolute top-8 right-8 text-gray-400 p-2 hover:bg-gray-50 rounded-full transition-colors">
          <X size={24} />
        </button>

        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div key="u" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 py-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Tải Video Lên</h2>
                <p className="text-sm text-gray-500 font-medium tracking-tight">Lưu trữ hành trình Video Modeling của bé (Cloudinary Storage).</p>
              </div>
              
              <label 
                htmlFor="video-input"
                className="border-4 border-dashed border-indigo-50 bg-indigo-50/20 rounded-[40px] h-72 flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-indigo-100/50 transition-all group"
              >
                <input type="file" id="video-input" accept="video/*" hidden onChange={handleFileChange} />
                <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center shadow-hpdt group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <p className="font-extrabold text-indigo-900 text-lg">Chọn video / Kéo thả</p>
                  <p className="text-[10px] text-indigo-300 font-black uppercase tracking-[0.3em] mt-2 italic">An toàn • Tốc độ Cloudinary</p>
                </div>
              </label>

              <div className="flex items-center gap-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50">
                <Sparkles size={24} className="text-blue-500" />
                <p className="text-xs text-blue-900 font-bold leading-relaxed">
                  Video sẽ được Cloudinary mã hóa và tự động bóc tách các hành vi kỹ năng sau khi tải lên.
                </p>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-96 space-y-10">
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="w-32 h-32 rounded-full border-4 border-indigo-50 border-t-primary"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video size={32} className="text-primary" />
                </div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg"
                >
                  {Math.round(uploadProgress)}%
                </motion.div>
              </div>

              <div className="w-full space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black text-gray-900 italic tracking-tight uppercase">Đang truyền tải dữ liệu...</h3>
                  <p className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase">Cloudinary CDN • Bảo mật HIPAA</p>
                </div>

                <div className="h-4 bg-indigo-50 rounded-full overflow-hidden shadow-inner p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="h-full bg-gradient-to-r from-primary to-indigo-600 rounded-full shadow-lg relative"
                  >
                     <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </motion.div>
                </div>

                <button 
                  onClick={handleCancelUpload}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-500 transition-colors py-2"
                >
                  <XCircle size={16} /> Hủy tải lên
                </button>
              </div>
            </motion.div>
          )}

          {step === "labeling" && (
            <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Trạng thái của bé?</h2>
                <p className="text-sm text-gray-500 font-medium">Bạn cảm thấy bé đang như thế nào trong video?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {emotions.map(emo => (
                  <button
                    key={emo}
                    onClick={() => toggleEmotion(emo)}
                    className={`py-5 rounded-[24px] text-sm font-black border-2 transition-all ${
                      selectedEmotions.includes(emo) 
                        ? 'bg-primary border-primary text-white shadow-hpdt scale-105' 
                        : 'bg-white border-gray-100 text-gray-500 hover:border-primary/20 hover:bg-primary/5'
                    }`}
                  >
                    {emo}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setStep("context")}
                className="w-full bg-primary text-white py-6 rounded-[24px] font-black text-lg shadow-hpdt active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tighter"
              >
                Tiếp tục <ChevronRight size={24} />
              </button>
            </motion.div>
          )}

          {step === "context" && (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Bối cảnh Video</h2>
                <p className="text-sm text-gray-500 font-medium">Video này được quay trong bối cảnh nào?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleContextSelect("Home")}
                  className="flex flex-col items-center gap-6 p-10 rounded-[40px] border-2 border-gray-100 hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors">
                    <Home size={32} />
                  </div>
                  <span className="font-black text-sm uppercase tracking-widest text-gray-900">Tại nhà</span>
                </button>
                <button 
                  onClick={() => handleContextSelect("School")}
                  className="flex flex-col items-center gap-6 p-10 rounded-[40px] border-2 border-gray-100 hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors">
                    <Building2 size={32} />
                  </div>
                  <span className="font-black text-sm uppercase tracking-widest text-gray-900">Tại trường</span>
                </button>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-80 space-y-6">
              <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 size={48} />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Tải lên Thành công!</h3>
                <p className="text-sm text-gray-500 mt-2 font-medium italic">Đang phân tích AI Pro cho bạn...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
