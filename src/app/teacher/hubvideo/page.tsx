"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Sparkles, RefreshCw, Upload, Loader2, 
  Calendar, Brain, CheckCircle2, ChevronRight,
  Target, Zap, Flame, Star
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { generateWeeklyComboAction } from "@/app/actions/gemini";
import VideoUploadModal from "@/components/VideoUploadModal";
import { getLearnersForTeacher } from "@/lib/services/learnerService";

interface Activity {
  lesson: string;
  category: string;
  description: string;
  primaryTag: string;
}

export default function InterventionHub() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingCombo, setFetchingCombo] = useState(false);
  const [combo, setCombo] = useState<Activity[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);

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

  // 2. Load Weekly Combo
  useEffect(() => {
    if (!selectedChild) return;
    loadChildCombo(selectedChild.id, false);
  }, [selectedChild]);

  async function loadChildCombo(childId: string, refresh: boolean) {
    setFetchingCombo(true);
    try {
      const comboRef = doc(db, "weekly_combos", childId);
      const snap = await getDoc(comboRef);
      
      if (snap.exists() && !refresh) {
        setCombo(snap.data().activities || []);
      } else {
        // Generate via AI
        const statsRef = doc(db, "hpdt_stats", childId);
        const statsSnap = await getDoc(statsRef);
        
        // Convert to plain object to avoid Server Action serialization errors (Timestamp issues)
        const stats = statsSnap.exists() 
          ? JSON.parse(JSON.stringify(statsSnap.data())) 
          : { hpdt: 70 };
        
        const aiResponse = await generateWeeklyComboAction(stats, selectedChild.name);
        
        // Simple regex/clean logic for AI output (assuming Gemini returns list-like text)
        // For this demo, we'll parse or mock if AI fails to return JSON
        let parsedCombo: Activity[] = [];
        try {
           // Try to extract JSON if AI wrapped it
           const jsonMatch = aiResponse.match(/\[.*\]/s);
           if (jsonMatch) {
             parsedCombo = JSON.parse(jsonMatch[0]);
           } else {
             // Fallback mock if parsing fails
             parsedCombo = [
               { lesson: "Tương tác mắt với thẻ hình", category: "Giao tiếp", description: "Bé nhìn vào thẻ hình 3-5 giây khi cô gọi tên.", primaryTag: "communication" },
               { lesson: "Dọn dẹp bàn học", category: "Tự phục vụ", description: "Bé tự cất bút và tập sau khi học xong.", primaryTag: "behavior" },
               { lesson: "Bắt chước động tác vỗ tay", category: "Vận động", description: "Bé vỗ tay theo hiệu lệnh của cô.", primaryTag: "sensory" },
               { lesson: "Chào hỏi giáo viên", category: "Xã hội", description: "Bé vẫy tay hoặc nói 'Chào cô'.", primaryTag: "social" },
             ];
           }
        } catch (e) {
           console.error("AI Combo Parsing failed", e);
        }

        if (parsedCombo.length > 0) {
          await setDoc(comboRef, { 
            activities: parsedCombo, 
            updatedAt: new Date(),
            childId: childId 
          });
          setCombo(parsedCombo);
        }
      }
    } catch (e) {
      console.error("Load combo failed:", e);
    } finally {
      setFetchingCombo(false);
    }
  }

  const handleUploadClick = (activity: Activity) => {
    setActiveActivity(activity);
    setIsUploadOpen(true);
  };

  const categoryColors: Record<string, string> = {
    "Giao tiếp": "bg-blue-50 text-blue-600 border-blue-100",
    "Tự phục vụ": "bg-orange-50 text-orange-600 border-orange-100",
    "Vận động": "bg-purple-50 text-purple-600 border-purple-100",
    "Xã hội": "bg-emerald-50 text-emerald-600 border-emerald-100",
    "Hành vi": "bg-red-50 text-red-600 border-red-100",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-calming-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-10 bg-calming-bg min-h-screen pb-40">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-4 sm:-mx-8 px-4 sm:px-8 border-b border-white/50 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Combo Can Thiệp Tuần</h1>
          <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 italic">
            AI-Driven Strategy • ABA/VB Methodology
          </p>
        </div>
        <button 
          onClick={() => selectedChild && loadChildCombo(selectedChild.id, true)}
          disabled={fetchingCombo}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-primary px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-primary/10 shadow-sm hover:bg-primary/5 transition-all"
        >
          {fetchingCombo ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Làm mới lộ trình (AI)
        </button>
      </header>

      {/* Child Selection Bar */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chọn trẻ để cá nhân hóa Combo bài tập</h4>
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

      {/* Main Content Area */}
      {fetchingCombo ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-6">
           <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-20 h-20 rounded-full border-4 border-primary/10 border-t-primary"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={24} className="text-primary animate-pulse" />
              </div>
           </div>
           <p className="text-sm font-black text-gray-900 uppercase tracking-tighter italic">AI đang kiến tạo lộ trình can thiệp...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {/* Hero Banner (Weekly Focus) */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-primary rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 text-white shadow-hpdt relative overflow-hidden"
          >
            <div className="absolute top-[-20px] right-[-20px] opacity-10 pointer-events-none">
              <Star size={160} />
            </div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-6">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-yellow-400/20 rounded-2xl flex items-center justify-center">
                        <Zap size={20} className="text-yellow-400 fill-yellow-400" />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Mục tiêu trọng tâm cho {selectedChild?.name}</span>
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-black tracking-tighter leading-tight italic">
                    "Tập trung vào miền <span className="underline decoration-yellow-400 decoration-4 underline-offset-8">Giao tiếp sớm</span> theo chuẩn VB-MAPP trong tuần này."
                  </h2>
               </div>
               <div className="bg-white/10 rounded-3xl p-8 backdrop-blur-md border border-white/10 space-y-6">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                     <span>Tiến độ combo tuần</span>
                     <span className="text-yellow-400">42%</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                     <motion.div initial={{ width: 0 }} animate={{ width: '42%' }} className="h-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                  </div>
                  <div className="flex gap-4">
                     <div className="flex-1 text-center">
                        <p className="text-2xl font-black">04</p>
                        <p className="text-[8px] font-bold uppercase opacity-60">Xong</p>
                     </div>
                     <div className="w-[1px] bg-white/10" />
                     <div className="flex-1 text-center">
                        <p className="text-2xl font-black">07</p>
                        <p className="text-[8px] font-bold uppercase opacity-60">Tổng</p>
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>

          {/* Activity List */}
          <div className="space-y-6">
             <div className="flex items-center gap-3">
                <Target size={20} className="text-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 italic">Chi tiết 5 bài can thiệp chủ chốt</h3>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {combo.length > 0 ? combo.map((activity, idx) => (
                   <motion.div
                    key={idx}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white rounded-[32px] sm:rounded-[40px] p-6 sm:p-8 border border-gray-50 shadow-soft hover:shadow-premium transition-all group flex flex-col"
                   >
                     <div className="flex justify-between items-start mb-6">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${categoryColors[activity.category] || "bg-gray-50 text-gray-500"}`}>
                           {activity.category}
                        </span>
                        <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-primary invisible group-hover:visible transition-all">
                           <ChevronRight size={18} />
                        </div>
                     </div>

                     <h4 className="text-xl font-black text-gray-900 tracking-tight leading-snug mb-3">{activity.lesson}</h4>
                     <p className="text-sm font-medium text-gray-500 leading-relaxed italic mb-8 flex-1">
                        "{activity.description}"
                     </p>

                     <button 
                        onClick={() => handleUploadClick(activity)}
                        className="w-full bg-primary text-white py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.03] transition-all"
                     >
                        <Upload size={18} /> Quay Video Can Thiệp
                     </button>
                   </motion.div>
                )) : (
                  <div className="col-span-full py-20 text-center bg-white/50 backdrop-blur-md rounded-[40px] border border-dashed border-gray-200">
                    <Brain size={48} className="text-gray-200 mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Chưa có bài dạy chủ chốt. Hãy chọn bé và bấm "Làm mới lộ trình".</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Floating Sparkles Button */}
      {selectedChild && !fetchingCombo && (
        <button 
          onClick={() => loadChildCombo(selectedChild.id, true)}
          className="fixed bottom-32 right-8 w-16 h-16 bg-white border-2 border-primary/20 text-primary rounded-[24px] shadow-2xl flex items-center justify-center active:scale-110 transition-all z-40 group"
          title="Yêu cầu AI lập lộ trình mới"
        >
          <Brain size={32} className="group-hover:text-primary transition-colors" />
        </button>
      )}

      {selectedChild && activeActivity && (
        <VideoUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          role="teacher"
          childId={selectedChild.id}
          initialTopic={activeActivity.lesson}
          initialLesson={activeActivity.lesson}
          initialCategory={activityToDomain(activeActivity.category)} // Map human name to behavioral domain
        />
      )}
    </div>
  );
}

// Helper to map UI category names back to behavioral domain tags
function activityToDomain(category: string): string {
  const map: Record<string, string> = {
    "Giao tiếp": "communication",
    "Tự học": "cognitive",
    "Tự phục vụ": "behavior",
    "Vận động": "sensory",
    "Xã hội": "social",
    "Hành vi": "behavior"
  };
  return map[category] || "general";
}
