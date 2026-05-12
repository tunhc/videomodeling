"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ChevronRight, Loader2, Users, CheckCircle, Info, Target
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, collection, query, where, getDocs, getDoc } from "firebase/firestore";
import { getLearnersForTeacher } from "@/lib/services/learnerService";

export default function TeacherSchedule() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Clinical & Lesson States
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);
  const [savingStep, setSavingStep] = useState<string | null>(null);

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

  // 2. Load Clinical Plan when child changes
  useEffect(() => {
    if (!selectedChild) return;
    loadClinicalPlan(selectedChild.id);
  }, [selectedChild]);

  async function loadClinicalPlan(childId: string) {
    try {
      const q = query(collection(db, "video_analysis"), where("childId", "==", childId));
      const aSnap = await getDocs(q);
      if (!aSnap.empty) {
        const analyses = aSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setLatestAnalysis(analyses[0]);
      } else {
        setLatestAnalysis(null);
      }

      const pQ = query(collection(db, "exercise_logs"), where("childId", "==", childId));
      const pSnap = await getDocs(pQ);
      const completed: string[] = [];
      const notes: Record<string, string> = {};
      pSnap.forEach(d => {
        const data = d.data();
        if (data.status === "teacher_done" || data.status === "both_done") {
          completed.push(data.stepId);
        }
        if (data.note) notes[data.stepId] = data.note;
      });
      setCompletedTasks(completed);
      setTaskNotes(notes);
    } catch (e) {
      console.error("Load clinical plan failed:", e);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedExercises(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const saveStepProgress = async (stepId: string, isDone: boolean) => {
    if (!selectedChild?.id) return;
    setSavingStep(stepId);
    try {
      const logRef = doc(collection(db, "exercise_logs"), `${selectedChild.id}_${stepId}`);
      const existing = await getDoc(logRef);
      let status = isDone ? "teacher_done" : "pending";

      if (existing.exists()) {
        const eData = existing.data();
        if (isDone && eData.status === "parent_done") status = "both_done";
        else if (!isDone && eData.status === "both_done") status = "parent_done";
      }

      await setDoc(logRef, {
        childId: selectedChild.id,
        stepId,
        status,
        note: taskNotes[stepId] || "",
        updatedAt: new Date(),
        teacherId: userId,
        teacherName: "Giáo viên",
      }, { merge: true });

      if (isDone) {
        setCompletedTasks(prev => prev.includes(stepId) ? prev : [...prev, stepId]);
      } else {
        setCompletedTasks(prev => prev.filter(s => s !== stepId));
      }
    } catch (e) {
      console.error("Failed to save progress:", e);
    } finally {
      setSavingStep(null);
    }
  };

  const saveNote = async (stepId: string) => {
    if (!selectedChild?.id) return;
    setSavingStep(stepId);
    try {
      const logRef = doc(collection(db, "exercise_logs"), `${selectedChild.id}_${stepId}`);
      await setDoc(logRef, {
        childId: selectedChild.id,
        stepId,
        note: taskNotes[stepId] || "",
        updatedAt: new Date(),
        teacherId: userId,
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save note:", e);
    } finally {
      setSavingStep(null);
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
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8 border-b border-white/50">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Kế hoạch dạy</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            Kế hoạch can thiệp cá nhân cho {selectedChild?.name || "Bé"}
          </p>
        </div>
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

      {/* Clinical Intervention Section */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-gray-900 tracking-tight">Kế hoạch can thiệp cá nhân</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Lộ trình bài học từ AI Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {["ABA", "OT", "DIR"].map(t => (
              <span key={t} className="text-[10px] font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-lg uppercase">{t}</span>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {latestAnalysis?.interventionPlan?.lessons?.map((lesson: any, idx: number) => {
            const exerciseId = lesson.lessonId || lesson.title || `ex-${idx}`;
            const isExpanded = expandedExercises.includes(exerciseId);
            const steps: any[] = lesson.steps || [];
            const completedCount = steps.filter((_: any, sIdx: number) => completedTasks.includes(`${exerciseId}-${sIdx}`)).length;
            const typeLabel = (lesson.lessonType || lesson.vmType || "ABA").replace(/_/g, " ").toUpperCase();
            const objective = lesson.rationale || lesson.steps?.[0]?.description || "";

            return (
              <motion.div key={exerciseId} layout className="bg-white rounded-[40px] shadow-soft border border-gray-50 overflow-hidden">
                <div onClick={() => toggleExpand(exerciseId)} className="p-8 cursor-pointer hover:bg-gray-50 transition-all">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex items-start gap-6 flex-1">
                      <div className="w-14 h-14 rounded-full bg-indigo-500 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-100 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xl font-black text-gray-900 leading-tight">
                            {lesson.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 font-black text-sm">{completedCount}/{steps.length}</span>
                            <ChevronRight size={20} className={`text-gray-300 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-lg uppercase">
                            {typeLabel}
                          </span>
                          <span className="bg-orange-50 text-orange-600 text-[10px] font-black px-3 py-1 rounded-lg uppercase">
                            Mục tiêu AI
                          </span>
                        </div>
                        {objective && (
                          <p className="text-gray-500 font-medium leading-relaxed text-sm">{objective}</p>
                        )}
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
                      className="border-t border-gray-50"
                    >
                      <div className="p-8 bg-gray-50/30 space-y-8">
                        <div className="flex items-center gap-2 text-indigo-600">
                          <Sparkles size={16} />
                          <h5 className="text-[10px] font-black uppercase tracking-widest">Các bước thực hiện tại trường</h5>
                        </div>
                        <div className="space-y-8">
                          {steps.map((step: any, sIdx: number) => {
                            const stepLabel = step.title || step.description || String(step);
                            const stepId = `${exerciseId}-${sIdx}`;
                            const isStepDone = completedTasks.includes(stepId);
                            const isSaving = savingStep === stepId;
                            return (
                              <div key={sIdx} className="flex gap-6 group">
                                <button
                                  onClick={() => saveStepProgress(stepId, !isStepDone)}
                                  disabled={isSaving}
                                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mt-1 ${
                                    isStepDone ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-gray-100 text-gray-300 group-hover:border-indigo-300"
                                  } ${isSaving ? "animate-pulse" : ""}`}
                                >
                                  {isSaving ? <Loader2 className="animate-spin" size={16} /> :
                                   isStepDone ? <CheckCircle size={20} /> : <span className="text-sm font-black">{sIdx + 1}</span>}
                                </button>
                                <div className="space-y-2 flex-1">
                                  <h6 className={`text-lg font-bold leading-tight transition-colors ${isStepDone ? "text-gray-300 line-through" : "text-gray-900"}`}>
                                    {stepLabel}
                                  </h6>
                                  {!isStepDone && step.therapistAction && (
                                    <p className="text-[11px] font-bold text-indigo-500 leading-relaxed italic">
                                      GV: {step.therapistAction}
                                    </p>
                                  )}
                                  <textarea
                                    placeholder="Ghi chú bước này..."
                                    value={taskNotes[stepId] || ""}
                                    onChange={(e) => setTaskNotes(prev => ({ ...prev, [stepId]: e.target.value }))}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-indigo-200 transition-all min-h-[72px] resize-none mt-2"
                                  />
                                  <button
                                    onClick={() => saveNote(stepId)}
                                    disabled={isSaving}
                                    className="mt-1 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50"
                                  >
                                    {isSaving ? <Loader2 size={12} className="animate-spin inline" /> : "Lưu ghi chú"}
                                  </button>
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

          {(!latestAnalysis || !latestAnalysis?.interventionPlan?.lessons?.length) && (
            <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-[40px] p-16 text-center">
              <Info className="mx-auto text-gray-300 mb-4" size={40} />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Chưa có kế hoạch can thiệp từ AI</p>
              <p className="text-xs text-gray-300 mt-2">Vui lòng thực hiện phân tích video để AI kiến tạo bài học.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
