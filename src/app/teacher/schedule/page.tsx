"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, Clock, User, Sparkles, ChevronRight, BookOpen, 
  Brain, Star, Upload, Loader2, Users, CheckCircle, Info,
  Wand2, X
} from "lucide-react";
import VideoUploadModal from "@/components/VideoUploadModal";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { videoService } from "@/lib/services/videoService";
import { generateLessonPlanAction } from "@/app/actions/gemini";

const DOMAIN_GOALS: Record<string, string[]> = {
  social: ["Chào hỏi giáo viên", "Chơi luân phiên", "Tương tác mắt"],
  communication: ["Yêu cầu đồ chơi", "Phát âm nguyên âm", "Chỉ tay vào vật"],
  behavior: ["Ngồi yên tại chỗ", "Lắng nghe chỉ dẫn", "Tự cất đồ chơi"],
  sensory: ["Vận động thăng bằng", "Phối hợp tay mắt", "Nhận biết xúc giác"],
  cognitive: ["Sắp xếp khối màu", "Phân loại hình dạng", "Hoàn thành Puzzle"]
};

export default function TeacherSchedule() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dailyCount, setDailyCount] = useState(0);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState("");
  
  // Lesson Plan States
  const [activeLessonPlan, setActiveLessonPlan] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [selectedItemForPlan, setSelectedItemForPlan] = useState<any>(null);

  const TEACHER_ID = "GV_DUONG_01";

  // 1. Load KBC Children
  useEffect(() => {
    async function loadChildren() {
      try {
        const q = query(collection(db, "children"), where("teacherId", "==", TEACHER_ID));
        const snap = await getDocs(q);
        const list = snap.docs.filter(d => d.id.startsWith("KBC-")).map(doc => ({ id: doc.id, ...doc.data() }));
        setChildren(list);
        if (list.length > 0) setSelectedChild(list[0]);
      } catch (e) {
        console.error("Load children failed:", e);
      } finally {
        setLoading(false);
      }
    }
    loadChildren();
  }, []);

  // 2. Load Stats & Daily Count when child changes
  useEffect(() => {
    if (!selectedChild) return;

    async function loadChildContext() {
      const count = await videoService.getDailyVideoCount(selectedChild.id);
      setDailyCount(count);

      const statsRef = doc(db, "hpdt_stats", selectedChild.id);
      const statsSnap = await getDoc(statsRef);
      
      let recoList: any[] = [];
      if (statsSnap.exists()) {
        const dims = statsSnap.data().dimensions || {};
        const sortedDims = Object.entries(dims).sort((a: any, b: any) => a[1] - b[1]);
        
        const primaryDomain = sortedDims[0][0];
        const secondaryDomain = sortedDims[1]?.[0] || primaryDomain;
        
        const goals1 = DOMAIN_GOALS[primaryDomain] || DOMAIN_GOALS.social;
        const goals2 = DOMAIN_GOALS[secondaryDomain] || DOMAIN_GOALS.communication;

        recoList = [
          { topic: goals1[0], domain: primaryDomain, priority: "High", stats: dims },
          { topic: goals2[0], domain: secondaryDomain, priority: "Medium", stats: dims },
          { topic: goals1[1], domain: primaryDomain, priority: "Low", stats: dims }
        ];
      } else {
        recoList = [
          { topic: "Chào hỏi giáo viên", domain: "social", priority: "High", stats: {} },
          { topic: "Phát âm nguyên âm", domain: "communication", priority: "Medium", stats: {} },
          { topic: "Ngồi yên tại chỗ", domain: "behavior", priority: "Low", stats: {} }
        ];
      }
      setRecommendations(recoList);
    }

    loadChildContext();
  }, [selectedChild]);

  const handleUploadClick = (topic: string) => {
    if (dailyCount >= 3) {
      alert("Bé đã đạt giới hạn 3 video modeling cho ngày hôm nay.");
      return;
    }
    setActiveTopic(topic);
    setIsUploadOpen(true);
  };

  const generatePlan = async (item: any) => {
    setGeneratingPlan(true);
    setSelectedItemForPlan(item);
    try {
      const plan = await generateLessonPlanAction(item.stats, item.domain);
      setActiveLessonPlan(plan);
    } catch (e) {
      setActiveLessonPlan("Không thể tạo giáo án lúc này. Vui lòng thử lại sau.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-calming-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight text-gradient bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600">Lịch dạy & Đề xuất AI</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            Dựa trên điểm số {selectedChild?.name || "Bé"}
          </p>
        </div>
        <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-primary">
          <Calendar size={24} />
        </div>
      </header>

      {/* Child Selection Bar */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chọn trẻ để xem lộ trình cụ thể</h4>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 no-scrollbar">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all whitespace-nowrap ${
                selectedChild?.id === child.id
                  ? "bg-primary text-white border-primary shadow-premium scale-105"
                  : "bg-white text-gray-600 border-gray-100 hover:border-primary/20"
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                selectedChild?.id === child.id ? "bg-white/20" : "bg-gray-50"
              }`}>
                {child.name?.[0]}
              </div>
              <span className="text-sm font-bold">{child.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Daily Progress & AI Suggestion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="lg:col-span-2 bg-primary rounded-[40px] p-8 text-white shadow-hpdt relative overflow-hidden"
        >
          <div className="absolute top-[-20px] right-[-20px] opacity-10 pointer-events-none">
            <Sparkles size={140} />
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Star size={18} className="fill-white" />
              <h3 className="text-[10px] font-black uppercase tracking-widest italic">Phân tích lộ trình thông minh</h3>
            </div>
            <div className="bg-white/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
              Lượt hôm nay: {dailyCount}/3
            </div>
          </div>
          <p className="text-lg font-black tracking-tight leading-relaxed italic mb-8">
            "{selectedChild?.name} đang cần cải thiện kỹ năng ở miền <b>{recommendations[0]?.domain || "ưu tiên"}</b>. Hệ thống đã thiết lập 3 bài học đề xuất bên dưới để cô thực hiện."
          </p>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
             <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${(dailyCount / 3) * 100}%` }}
              className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
             />
          </div>
        </motion.div>

        <div className="bg-white rounded-[40px] p-8 border border-gray-50 shadow-soft flex flex-col justify-center items-center text-center space-y-4">
           {dailyCount >= 3 ? (
             <>
               <CheckCircle size={48} className="text-emerald-500" />
               <h4 className="text-xl font-black text-gray-900">Mục tiêu ngày đã xong!</h4>
               <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Tuyệt vời, cô đã nạp đủ 3 video cho {selectedChild?.name}.</p>
             </>
           ) : (
             <>
               <Brain size={48} className="text-primary/20" />
               <h4 className="text-xl font-black text-gray-900">Mục tiêu tiếp theo</h4>
               <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Cô còn {3 - dailyCount} video cần quay hôm nay.</p>
             </>
           )}
        </div>
      </div>

      {/* Dynamic Recommendation Cards */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-primary" />
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Gợi ý bài tập Modeling dựa trên hpDT</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-[40px] p-8 border border-gray-50 shadow-soft hover:shadow-premium transition-all group relative overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      item.priority === 'High' ? 'bg-red-50 text-red-500' : 
                      item.priority === 'Medium' ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-400'
                    }`}>
                      Ưu tiên: {item.priority}
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-gray-900 tracking-tight leading-tight pt-2">{item.topic}</h4>
                </div>
                <div className="p-3 bg-indigo-50 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all">
                  <Sparkles size={16} />
                </div>
              </div>

              <div className="space-y-3 mt-auto">
                 <button 
                  onClick={() => generatePlan(item)}
                  className="w-full bg-white border-2 border-primary/10 hover:border-primary/40 py-4 rounded-2xl flex items-center justify-center gap-3 text-primary text-[10px] font-black uppercase tracking-widest transition-all"
                 >
                   <Wand2 size={18} /> Xem giáo án chuẩn
                 </button>
                 
                 <button 
                  onClick={() => handleUploadClick(item.topic)}
                  disabled={dailyCount >= 3}
                  className="w-full bg-primary text-white shadow-lg shadow-primary/20 py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:pointer-events-none"
                 >
                   <Upload size={18} /> Quay Video Modeling
                 </button>

                 <div className="flex items-center justify-between pt-6 border-t border-gray-50 text-[9px] font-black uppercase tracking-widest text-gray-400">
                    <span className="flex items-center gap-2 italic">Lộ trình: {selectedChild?.name}</span>
                    <span className="text-primary">{item.domain}</span>
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Lesson Plan Modal */}
      <AnimatePresence>
        {(generatingPlan || activeLessonPlan) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl border border-white/20 relative"
            >
              <div className="bg-primary p-10 text-white relative">
                 <button 
                  onClick={() => { setActiveLessonPlan(null); setGeneratingPlan(false); }}
                  className="absolute top-8 right-8 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all"
                 >
                   <X size={20} />
                 </button>
                 <div className="flex items-center gap-4 mb-4">
                    <Brain size={32} className="opacity-50" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">AI Giáo án chuẩn (VST Specialist)</h3>
                 </div>
                 <h2 className="text-3xl font-black tracking-tight">{selectedItemForPlan?.topic}</h2>
                 <p className="text-sm opacity-60 mt-2 font-bold uppercase tracking-widest italic">{selectedItemForPlan?.domain} • Ưu tiên {selectedItemForPlan?.priority}</p>
              </div>

              <div className="p-10 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-8">
                 {generatingPlan ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
                       <Loader2 className="animate-spin text-primary" size={60} />
                       <div>
                          <h4 className="text-xl font-black text-gray-900 italic uppercase tracking-tighter">Đang kiến tạo giáo án...</h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2 px-12">AI đang phân tích hpDT để đưa ra các bước can thiệp tối ưu nhất.</p>
                       </div>
                    </div>
                 ) : (
                    <div className="prose prose-slate max-w-none text-gray-700 font-medium leading-relaxed whitespace-pre-line">
                       {activeLessonPlan}
                    </div>
                 )}
              </div>

              <div className="p-10 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <Info size={20} className="text-gray-400" />
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest max-w-[200px]">Hãy thực hiện theo các bước trên khi quay video Modeling.</p>
                 </div>
                 <button 
                  onClick={() => { setActiveLessonPlan(null); handleUploadClick(selectedItemForPlan?.topic); }}
                  className="bg-primary text-white px-8 py-5 rounded-3xl font-black text-[12px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                 >
                    Bắt đầu Quay Video
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <VideoUploadModal 
        role="teacher" 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        childId={selectedChild?.id}
        initialTopic={activeTopic}
      />
    </div>
  );
}
