import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, CheckCircle2, Loader2, Sparkles, ChevronRight, Video, Home, Building2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { videoService } from "@/lib/services/videoService";
import { cloudinaryService } from "@/lib/services/cloudinaryService";
import { getLearnerByIdAnyCollection, resolveLearnerForParent } from "@/lib/services/learnerService";

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: "parent" | "teacher";
  childId?: string | null;
  initialTopic?: string;
  initialLesson?: string;
  initialCategory?: string;
  onSuccess?: () => void;
}

export default function VideoUploadModal({
  isOpen,
  onClose,
  role,
  childId,
  initialTopic,
  initialLesson,
  initialCategory,
  onSuccess
}: VideoUploadModalProps) {
  const router = useRouter();
  const rawMaxUploadMb = (process.env.NEXT_PUBLIC_CLOUDINARY_MAX_FILE_SIZE_MB || "").trim();
  const configuredMaxUploadMb = Number(rawMaxUploadMb);
  const hasClientUploadCap =
    rawMaxUploadMb.length > 0 && Number.isFinite(configuredMaxUploadMb) && configuredMaxUploadMb > 0;
  const maxUploadMb = hasClientUploadCap ? configuredMaxUploadMb : null;
  const displayMaxUploadMb = maxUploadMb ?? 0;
  const maxUploadBytes = hasClientUploadCap && maxUploadMb !== null
    ? Math.floor(maxUploadMb * 1024 * 1024)
    : null;
  const [step, setStep] = useState<"upload" | "processing" | "labeling" | "context" | "success">("upload");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [durationNotice, setDurationNotice] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const emotions = ["Vui vẻ", "Bình thường", "Căng thẳng", "Khóc/Quấy", "Kích động", "Sợ hãi"];

  const readVideoDuration = async (inputFile: File): Promise<number | null> => {
    return new Promise<number | null>((resolve) => {
      const tempVideo = document.createElement("video");
      const objectUrl = URL.createObjectURL(inputFile);
      let settled = false;

      const cleanup = () => {
        tempVideo.onloadedmetadata = null;
        tempVideo.onloadeddata = null;
        tempVideo.ondurationchange = null;
        tempVideo.onerror = null;
        tempVideo.src = "";
        URL.revokeObjectURL(objectUrl);
      };

      const finalize = (value: number | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const tryResolve = () => {
        const duration = Number(tempVideo.duration);
        if (Number.isFinite(duration) && duration > 0) {
          finalize(duration);
        }
      };

      const timeout = setTimeout(() => finalize(null), 15000);
      const wrap = () => {
        clearTimeout(timeout);
        tryResolve();
      };

      tempVideo.preload = "metadata";
      tempVideo.muted = true;
      tempVideo.playsInline = true;
      tempVideo.onloadedmetadata = wrap;
      tempVideo.onloadeddata = wrap;
      tempVideo.ondurationchange = wrap;
      tempVideo.onerror = () => {
        clearTimeout(timeout);
        finalize(null);
      };

      tempVideo.src = objectUrl;
      tempVideo.load();
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError("");
      setDurationNotice("");

      if (maxUploadBytes !== null && file.size > maxUploadBytes) {
        const currentSizeMb = (file.size / (1024 * 1024)).toFixed(1);
        setVideo(null);
        setStep("upload");
        e.target.value = "";
        setUploadError(
          `Video ${currentSizeMb}MB vượt giới hạn cấu hình hiện tại (${displayMaxUploadMb}MB). ` +
            "Vui lòng cắt ngắn video, nén xuống 720p hoặc chia thành nhiều clip nhỏ."
        );
        return;
      }

      setIsChecking(true);
      try {
        const duration = await readVideoDuration(file);

        if (typeof duration === "number" && (duration < 15 || duration > 300)) {
          const minutes = Math.floor(duration / 60);
          const seconds = Math.round(duration % 60);
          const durationStr = `${minutes} phút ${seconds} giây`;
          
          setUploadError(
            `Thời lượng video của bạn (${durationStr}) không nằm trong khoảng yêu cầu. ` +
            "Vui lòng xem lại và chọn video từ 15 giây đến 5 phút để đảm bảo chất lượng phân tích."
          );
          setVideo(null);
          e.target.value = "";
          return;
        }

        if (duration === null) {
          setDurationNotice(
            "Hệ thống chưa đọc được thời lượng ngay trên thiết bị này. Bạn vẫn có thể tiếp tục tải lên, hệ thống sẽ tự kiểm tra ở bước sau."
          );
        }

        setVideoDuration(typeof duration === "number" ? duration : 0);
        setVideo(file);
        setStep("labeling");
      } catch {
        setUploadError("Có lỗi xảy ra khi kiểm tra video. Vui lòng thử lại.");
      } finally {
        setIsChecking(false);
      }
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

  const handleLocationSelect = (loc: string | null) => {
    handleFinish(loc);
  };

  const handleFinish = async (selectedLocation: string | null) => {
    if (!video) return;
    
    setStep("processing"); 
    setUploadProgress(0);
    setUploadError("");
    abortControllerRef.current = new AbortController();
    
    try {
      // Resolve Child Metadata for Cloudinary Folder Organization
      let activeChildId = childId;
      let centerCode = "KBC";
      let childName = "";

      // If parent and no childId passed, resolve from localStorage/Profile
      if (role === "parent" && !activeChildId) {
         const userId = localStorage.getItem("userId") || "";
         const learner = await resolveLearnerForParent(userId);
         if (learner) {
           activeChildId = learner.id;
           centerCode = learner.schoolCode || centerCode;
           childName = learner.name || childName;
         } else {
           activeChildId = userId.replace("PH_", "");
         }
      }

      // Fetch Child data to get schoolCode (centerCode) and name
      if (activeChildId) {
        try {
          const learner = await getLearnerByIdAnyCollection(activeChildId);
          if (learner) {
            // If schoolCode is just "KBC", try to get more specific code from ID (e.g., KBC-HCM)
            let sc = learner.schoolCode || "KBC";
            if (sc === "KBC" && activeChildId.includes("_")) {
              sc = activeChildId.split("_")[0];
            }
            centerCode = sc;
            childName = learner.name || "";
          }
        } catch (e) {
          console.error("Failed to fetch child data:", e);
        }
      }

      const uploadChildId = activeChildId || "KBC-HCM_Long_B01";
      
      const now = new Date();
      const timestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      const defaultName = childName ? `${childName} - ${timestamp}` : video.name;
      const finalTopic = initialTopic || defaultName;

      // 2. Upload to Cloudinary with standardized naming
      const locationMapping: Record<string, string> = {
        "Tại nhà": "home",
        "Tại trường": "school",
        "Công cộng": "public",
        "Khác": "other"
      };
      const locationSlug = selectedLocation ? locationMapping[selectedLocation] : "unspecified";

      // 2b. Get daily count for correct indexing (e.g., -01, -02)
      const dailyCount = await videoService.getDailyVideoCount(uploadChildId);

      const cloudinaryResult = await cloudinaryService.uploadVideo(
        video,
        { 
          childId: uploadChildId, 
          centerName: centerCode, 
          role: role,
          location: locationSlug,
          index: dailyCount + 1
        },
        (progress) => setUploadProgress(progress),
        abortControllerRef.current
      );

      const finalDuration =
        videoDuration > 0
          ? videoDuration
          : typeof cloudinaryResult.duration === "number"
          ? cloudinaryResult.duration
          : 0;

      // 3. Register Metadata in Firebase
      const newVideo = await videoService.registerVideoMetadata(
        cloudinaryResult.secureUrl, 
        uploadChildId,
        selectedEmotions[0] || "General", 
        { 
          allTags: selectedEmotions,
          location: selectedLocation || "",
          context: selectedLocation === "Tại trường" ? "school" : "home",
          topic: finalTopic,
          duration: Math.round(finalDuration),
          lesson: initialLesson || "",
          category: initialCategory || ""
        },
        role
      );
      
      setStep("success");
      onSuccess?.();
      
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
    } catch (error: unknown) {
      let message = "Không xác định";
      if (error instanceof Error && typeof error.message === "string") {
        message = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
      ) {
        message = (error as { message: string }).message;
      }
      const messageLower = message.toLowerCase();
      if (message === "Upload canceled") {
        console.log("Upload canceled by user");
      } else {
        console.error("Upload failed:", error);
        if (
          messageLower.includes("network error") ||
          messageLower.includes("timeout") ||
          messageLower.includes("offline") ||
          messageLower.includes("kết nối")
        ) {
          setUploadError(
            "Kết nối mạng đang không ổn định nên tải lên bị gián đoạn. " +
              "Vui lòng giữ màn hình sáng, chuyển sang Wi-Fi/4G ổn định và thử lại."
          );
        } else if (messageLower.includes("file size too large")) {
          if (hasClientUploadCap) {
            setUploadError(
              `Cloudinary từ chối file vượt giới hạn hiện tại (${displayMaxUploadMb}MB). ` +
                "Vui lòng giảm dung lượng hoặc tách clip trước khi tải lên."
            );
          } else {
            setUploadError(
              "Cloudinary từ chối file vì vượt giới hạn preset/gói hiện tại. " +
                "Vui lòng tăng giới hạn trên Cloudinary hoặc giảm dung lượng video."
            );
          }
        } else {
          setUploadError(`Tải lên thất bại: ${message}`);
        }
        alert("Lỗi tải lên: " + message);
        setStep("upload");
      }
    }
  };

  const resetModal = () => {
    setStep("upload");
    setVideo(null);
    setSelectedEmotions([]);
    setUploadError("");
    setUploadProgress(0);
    setDurationNotice("");
    abortControllerRef.current = null;
  };

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions(prev => 
      prev.includes(emotion) ? prev.filter(e => e !== emotion) : [...prev, emotion]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] p-6 sm:p-10 space-y-6 sm:space-y-8 shadow-2xl relative max-h-[95vh] sm:max-h-none overflow-y-auto sm:overflow-visible"
      >
        <button onClick={() => { if(step === 'upload' || step === 'success') onClose(); else handleCancelUpload(); }} className="absolute top-6 right-6 sm:top-8 sm:right-8 text-gray-400 p-2 hover:bg-gray-50 rounded-full transition-colors z-50">
          <X size={24} />
        </button>

        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div key="u" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 sm:space-y-8 py-2 sm:py-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Tải Video Lên</h2>
                <p className="text-sm text-gray-500 font-medium tracking-tight">Lưu trữ hành trình Video Modeling của bé (Cloudinary Storage).</p>
                {hasClientUploadCap ? (
                  <p className="text-xs text-amber-600 font-bold">Giới hạn hiện tại: tối đa {displayMaxUploadMb}MB mỗi video.</p>
                ) : (
                  <p className="text-xs text-amber-600 font-bold">Giới hạn hiện tại: theo cấu hình Cloudinary của hệ thống.</p>
                )}

                <div className="mt-4 space-y-1.5 border-l-2 border-indigo-100 pl-4 py-1">
                  <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Lưu ý cho video:</p>
                  <ul className="text-xs space-y-1 text-gray-600 font-medium">
                    <li>• <span className="text-red-500 font-bold">Thời gian video: 15 giây - 5 phút</span></li>
                    <li>• Chất lượng rõ nét</li>
                    <li>• Ánh sáng đầy đủ</li>
                    <li>• Bao gồm góc quay chính diện hoặc góc quay 45 độ</li>
                    <li>• Hạn chế rung lắc video</li>
                  </ul>
                </div>
              </div>
              
              <label 
                htmlFor="video-input"
                className={`border-4 border-dashed border-indigo-50 bg-indigo-50/20 rounded-[32px] sm:rounded-[40px] h-48 sm:h-72 flex flex-col items-center justify-center gap-4 sm:gap-6 cursor-pointer hover:bg-indigo-100/50 transition-all group ${isChecking ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input type="file" id="video-input" accept="video/*" hidden onChange={handleFileChange} disabled={isChecking} />
                <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center shadow-hpdt group-hover:scale-110 transition-transform">
                  {isChecking ? <Loader2 size={32} className="animate-spin" /> : <Upload size={32} />}
                </div>
                <div className="text-center">
                  <p className="font-extrabold text-indigo-900 text-lg">
                    {isChecking ? "Đang kiểm tra video..." : "Chọn video / Kéo thả"}
                  </p>
                  <p className="text-[10px] text-indigo-300 font-black uppercase tracking-[0.3em] mt-2 italic">
                    {isChecking ? "Vui lòng đợi trong giây lát" : "An toàn • Tốc độ Cloudinary"}
                  </p>
                </div>
              </label>

              {uploadError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold leading-relaxed">
                  {uploadError}
                </div>
              ) : null}

              {durationNotice ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 font-semibold leading-relaxed">
                  {durationNotice}
                </div>
              ) : null}

              <div className="flex items-center gap-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50">
                <Sparkles size={24} className="text-blue-500" />
                <p className="text-xs text-blue-900 font-bold leading-relaxed">
                  Video sẽ được Cloudinary mã hóa và tự động bóc tách các hành vi kỹ năng sau khi tải lên.
                </p>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[300px] sm:h-96 space-y-8 sm:space-y-10">
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
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Trạng thái của bé?</h2>
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
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Vị trí quay Video?</h2>
                <p className="text-sm text-gray-500 font-medium">Bé đang ở đâu trong video này?</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'home', label: 'Tại nhà', icon: <Home size={24} /> },
                  { id: 'school', label: 'Tại trường', icon: <Building2 size={24} /> },
                  { id: 'public', label: 'Công cộng', icon: <Sparkles size={24} /> },
                  { id: 'other', label: 'Khác', icon: <Video size={24} /> }
                ].map((loc) => (
                  <button 
                    key={loc.id}
                    onClick={() => handleLocationSelect(loc.label)}
                    className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border-2 border-gray-100 hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors">
                      {loc.icon}
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-widest text-gray-900">{loc.label}</span>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => handleLocationSelect(null)}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-gray-600 transition-colors"
              >
                Bỏ qua bước này
              </button>
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
