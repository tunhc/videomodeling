"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, Clock, User, Sparkles, ChevronRight, BookOpen, 
  Brain, Star, Upload, Loader2, Users, CheckCircle, Info,
  Wand2, X, RefreshCw, ChevronLeft, Target, Zap
} from "lucide-react";
import VideoUploadModal from "@/components/VideoUploadModal";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { generateWeeklyScheduleAction, generateLessonPlanAction } from "@/app/actions/gemini";
import { getLearnersForTeacher } from "@/lib/services/learnerService";

interface Activity {
  title: string;
  description: string;
  domain: string;
  requiresModeling: boolean;
}

interface DaySchedule {
  day: string;
  activities: Activity[];
}

export default function TeacherSchedule() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingSchedule, setFetchingSchedule] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState("");
  
  // Lesson Plan States
  const [activeLessonPlan, setActiveLessonPlan] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [selectedActivityForPlan, setSelectedActivityForPlan] = useState<Activity | null>(null);

  const userId = typeof window !== 'undefined' ? localStorage.getItem("userId") || "" : "";
  const userRole = typeof window !== 'undefined' ? localStorage.getItem("userRole") || "teacher" : "teacher";

  // 1. Load Children
  useEffect(() => {
    async function loadChildren() {
      try {
        const list = await getLearnersForTeacher(userId, userRole);
        setChildren(list);
        if (list.length > 0) setSelectedChild(list[0]);
      } catch (e) {
        console.error("Load children failed:", e);
      } finally {
        setLoading(false);
      }
    }
    loadChildren();
  }, [userId, userRole]);

  // 2. Load Weekly Schedule when child changes
  useEffect(() => {
    if (!selectedChild) return;
    loadWeeklySchedule(selectedChild.id, false);
  }, [selectedChild]);

  async function loadWeeklySchedule(childId: string, refresh: boolean) {
    setFetchingSchedule(true);
    try {
      const scheduleRef = doc(db, "weekly_schedules", childId);
      const snap = await getDoc(scheduleRef);
      
      if (snap.exists() && !refresh) {
        setWeeklySchedule(snap.data().days || []);
      } else {
        const statsRef = doc(db, "hpdt_stats", childId);
        const statsSnap = await getDoc(statsRef);
        const stats = statsSnap.exists() 
          ? JSON.parse(JSON.stringify(statsSnap.data())) 
          : { hpdt: 70 };
        
        const aiResponse = await generateWeeklyScheduleAction(stats, selectedChild.name);
        
        let parsedSchedule: DaySchedule[] = [];
        try {
           const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
           if (jsonMatch) {
             parsedSchedule = JSON.parse(jsonMatch[0]);
           } else {
             // Fallback mock
             parsedSchedule = generateMockSchedule();
           }
        } catch (e) {
           console.error("AI parsing failed", e);
           parsedSchedule = generateMockSchedule();
        }

        if (parsedSchedule.length > 0) {
          await setDoc(scheduleRef, { 
            days: parsedSchedule, 
            updatedAt: new Date(),
            childId: childId 
          });
          setWeeklySchedule(parsedSchedule);
        }
      }
    } catch (e) {
      console.error("Load schedule failed:", e);
    } finally {
      setFetchingSchedule(false);
    }
  }

  const handleUploadClick = (topic: string) => {
    setActiveTopic(topic);
    setIsUploadOpen(true);
  };

  const showLessonPlan = async (activity: Activity) => {
    setGeneratingPlan(true);
    setSelectedActivityForPlan(activity);
    try {
      const plan = await generateLessonPlanAction({ hpdt: 70 }, activity.domain);
      setActiveLessonPlan(plan);
    } catch (e) {
      setActiveLessonPlan("Không thể tạo giáo án lúc này.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  const domainColors: Record<string, string> = {
    "Giao tiếp": "bg-blue-50 text-blue-600 border-blue-100",
    "Social": "bg-emerald-50 text-emerald-600 border-emerald-100",
    "Xã hội": "bg-emerald-50 text-emerald-600 border-emerald-100",
    "Hành vi": "bg-red-50 text-red-600 border-red-100",
    "Behavior": "bg-red-50 text-red-600 border-red-100",
    "Vận động": "bg-purple-50 text-purple-600 border-purple-100",
    "Sensory": "bg-purple-50 text-purple-600 border-purple-100",
    "Tự học": "bg-orange-50 text-orange-600 border-orange-100",
    "Cognitive": "bg-orange-50 text-orange-600 border-orange-100",
    "Tự phục vụ": "bg-amber-50 text-amber-600 border-amber-100",
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
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8 border-b border-white/50">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Kế hoạch dậy & Lộ trình tuần</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            Phân tích AI cho {selectedChild?.name || "Bé"} • Thứ 2 - Chủ Nhật
          </p>
        </div>
        <button 
          onClick={() => selectedChild && loadWeeklySchedule(selectedChild.id, true)}
          disabled={fetchingSchedule}
          className="flex items-center gap-2 bg-white text-primary px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-primary/10 shadow-sm hover:bg-primary/5 transition-all"
        >
          {fetchingSchedule ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Tạo lại lịch dạy (AI)
        </button>
      </header>

      {/* Child Selection Bar */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chọn trẻ để thay đổi giáo án cá nhân hóa</h4>
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

      {fetchingSchedule ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-6">
           <Loader2 className="animate-spin text-primary" size={60} />
           <p className="text-sm font-black text-gray-900 uppercase tracking-tighter italic">AI đang kiến tạo lộ trình 7 ngày...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {weeklySchedule.map((day, dIdx) => (
            <section key={dIdx} className="space-y-6">
               <div className="flex items-center gap-6">
                  <div className="bg-primary text-white w-20 h-20 rounded-[28px] flex flex-col items-center justify-center shadow-lg shadow-primary/20">
                     <span className="text-[10px] font-black uppercase opacity-60">Day</span>
                     <span className="text-2xl font-black">{dIdx + 1}</span>
                  </div>
                  <div>
                     <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-none">{day.day}</h3>
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1.5 italic">Lộ trình 3 bài tập chuẩn ABA • Tiết 1, 2, 3</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {day.activities.map((activity, aIdx) => (
                    <motion.div
                      key={aIdx}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: aIdx * 0.1 }}
                      className="bg-white rounded-[40px] p-8 border border-gray-50 shadow-soft hover:shadow-premium transition-all group flex flex-col relative"
                    >
                      <div className="flex justify-between items-start mb-6">
                         <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${domainColors[activity.domain] || "bg-gray-50 text-gray-500"}`}>
                            {activity.domain}
                         </span>
                         {activity.requiresModeling && (
                           <div className="bg-yellow-50 text-yellow-600 p-2 rounded-xl" title="Yêu cầu Video Modeling">
                              <Star size={14} className="fill-yellow-600" />
                           </div>
                         )}
                      </div>

                      <h4 className="text-lg font-black text-gray-900 tracking-tight leading-snug mb-3">{activity.title}</h4>
                      <p className="text-[11px] font-medium text-gray-500 leading-relaxed italic mb-8 flex-1">
                         "{activity.description}"
                      </p>

                      <div className="space-y-3">
                         <button 
                            onClick={() => showLessonPlan(activity)}
                            className="w-full bg-white border border-gray-100 text-gray-600 py-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                         >
                            <BookOpen size={16} /> Giáo án AI
                         </button>
                         {activity.requiresModeling && (
                           <button 
                              onClick={() => handleUploadClick(activity.title)}
                              className="w-full bg-primary text-white py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.03] transition-all"
                           >
                              <Upload size={18} /> Quay Video Modeling
                           </button>
                         )}
                      </div>
                    </motion.div>
                  ))}
               </div>
            </section>
          ))}
        </div>
      )}

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
                    <h3 className="text-[10px] font-black uppercase tracking-widest">AI Guide (VST Specialist)</h3>
                 </div>
                 <h2 className="text-3xl font-black tracking-tight">{selectedActivityForPlan?.title}</h2>
                 <p className="text-sm opacity-60 mt-2 font-bold uppercase tracking-widest italic">{selectedActivityForPlan?.domain}</p>
              </div>

              <div className="p-10 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-8">
                 {generatingPlan ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
                       <Loader2 className="animate-spin text-primary" size={60} />
                       <h4 className="text-xl font-black text-gray-900 italic uppercase tracking-tighter">Đang kiến tạo giáo án chi tiết...</h4>
                    </div>
                 ) : (
                    <div className="prose prose-slate max-w-none text-gray-700 font-medium leading-relaxed whitespace-pre-line">
                       {activeLessonPlan}
                    </div>
                 )}
              </div>

              <div className="p-10 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
                 <button 
                  onClick={() => setActiveLessonPlan(null)}
                  className="px-8 py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all"
                 >
                    Đóng
                 </button>
                 {selectedActivityForPlan?.requiresModeling && (
                    <button 
                      onClick={() => { setActiveLessonPlan(null); handleUploadClick(selectedActivityForPlan.title); }}
                      className="bg-primary text-white px-8 py-5 rounded-3xl font-black text-[12px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      Quay Video Ngay
                    </button>
                 )}
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

function generateMockSchedule(): DaySchedule[] {
  const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
  return days.map(d => ({
    day: d,
    activities: [
      { title: "Chào hỏi giáo viên", description: "Bé nhìn vào mắt cô và vẫy tay.", domain: "Xã hội", requiresModeling: true },
      { title: "Sắp xếp khối màu", description: "Phân loại 3 màu cơ bản.", domain: "Cognitive", requiresModeling: false },
      { title: "Dọn dẹp bàn học", description: "Cất bút vào hộp sau khi học.", domain: "Tự phục vụ", requiresModeling: true },
    ]
  }));
}
