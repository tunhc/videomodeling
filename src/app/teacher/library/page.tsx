"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Target, Sparkles, Video, MessageSquare, 
  ChevronRight, ArrowRight, Play, Camera, 
  Zap, Users, AlertCircle, Layout, School, 
  Coffee, Music, Info, Loader2, FileDown, 
  Clock, Activity, TrendingUp, ChevronUp, ChevronDown, 
  BarChart2, SortDesc, SortAsc, Calendar, 
  CheckCircle2, AlertTriangle, FileText
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, getDocs, orderBy, limit, doc, getDoc 
} from "firebase/firestore";
import { getLearnersForTeacher } from "@/lib/services/learnerService";
import { getAuthSession } from "@/lib/auth-session";
import { cloudinaryService } from "@/lib/services/cloudinaryService";
import UserMenu from "@/components/layout/UserMenu";

// --- Types ---
interface Student {
  id: string;
  name: string;
  initial: string;
  avatarUrl?: string;
  hpdt: number;
}

interface ParentVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  createdAt: any;
  status: string;
}

interface Intervention {
  id: string;
  title: string;
  objective: string;
  steps: string[];
  topic: string;
  isModelingSuggested: boolean;
}

interface AnalysisData {
  focus: number;
  interaction: string;
  behavior: string;
  level: number;
  interventions: Intervention[];
}

// --- Components ---

export default function TeacherLibrary() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [parentVideos, setParentVideos] = useState<ParentVideo[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [activeTopic, setActiveTopic] = useState<string>("Tất cả");
  const [userName, setUserName] = useState("Giáo viên");

  // Analysis Log States
  const [logs, setLogs] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sourceFilter, setSourceFilter] = useState<"all" | "parent" | "teacher">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      try {
        const session = getAuthSession();
        const userId = session?.userId || localStorage.getItem("userId") || "";
        const role = session?.userRole || localStorage.getItem("userRole") || "teacher";

        const teacherDoc = await getDoc(doc(db, "users", userId));
        if (teacherDoc.exists()) {
          setUserName(teacherDoc.data().displayName || "Giáo viên");
        }

        const learners = await getLearnersForTeacher(userId, role);
        const list: Student[] = learners.map(l => ({
          id: l.id,
          name: l.name || "Học sinh",
          initial: l.name ? l.name[0] : "?",
          avatarUrl: l.avatarUrl as string,
          hpdt: (l.hpdt as number) || 75
        }));
        setStudents(list);
        if (list.length > 0) {
          setSelectedStudentId(list[0].id);
        }
      } catch (e) {
        console.error("Failed to load library data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;

    async function loadStudentDetails() {
      try {
        // Fetch 2 newest parent videos
        const vQuery = query(
          collection(db, "video_modeling"),
          where("childId", "==", selectedStudentId)
        );
        const vSnap = await getDocs(vQuery);
        let vList = vSnap.docs.map(d => {
          const raw = d.data();
          const videoUrl = raw.url ? cloudinaryService.deobfuscateUrl(raw.url) : "";
          const thumbnail = videoUrl.includes("cloudinary.com")
            ? videoUrl.replace(/\.[^./?#]+(\?.*)?$/, ".jpg").replace("/video/upload/", "/video/upload/so_0/")
            : "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&q=80&w=400";
          return {
            id: d.id,
            title: raw.title || "Video từ phụ huynh",
            url: videoUrl,
            thumbnail,
            createdAt: raw.createdAt,
            status: raw.status
          };
        });

        // Sort on client to avoid Firebase index error
        vList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
          const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
          return timeB - timeA;
        });

        setParentVideos(vList.slice(0, 2));

        // Fetch HPDT stats for accurate metrics
        const statsRef = doc(db, "hpdt_stats", selectedStudentId!);
        const statsSnap = await getDoc(statsRef);
        let currentHpdt = 75;
        let currentDimensions = { communication: 75, social: 75, behavior: 75 };

        if (statsSnap.exists()) {
          const sData = statsSnap.data();
          currentHpdt = sData.overallScore || 75;
          currentDimensions = sData.dimensions || currentDimensions;
        }

        // Calculate Level based on AI Measure (HPDT score)
        // Level 1: < 65, Level 2: 65-80, Level 3: > 80
        const calculatedLevel = currentHpdt < 65 ? 1 : currentHpdt < 80 ? 2 : 3;

        // Fetch latest analysis for interventions
        const aQuery = query(
          collection(db, "video_analysis"),
          where("childId", "==", selectedStudentId)
        );
        const aSnap = await getDocs(aQuery);
        let fetchedInterventions: Intervention[] = [];

        if (!aSnap.empty) {
          // Sort on client to avoid Firebase index error
          const sortedDocs = [...aSnap.docs].sort((a, b) => {
            const timeA = a.data().createdAt?.toMillis?.() || a.data().createdAt?.seconds * 1000 || 0;
            const timeB = b.data().createdAt?.toMillis?.() || b.data().createdAt?.seconds * 1000 || 0;
            return timeB - timeA;
          });

          const aData = sortedDocs[0].data();
          const rawInterventions = aData.clinicalAnalysis?.interventions || [];
          
          fetchedInterventions = rawInterventions.map((inv: any, idx: number) => {
            const content = (inv.title + " " + inv.objective + " " + inv.steps.join(" ")).toLowerCase();
            const isModeling = content.includes("làm mẫu") || content.includes("mô hình hóa") || content.includes("modeling");
            
            // Extract dynamic topic based on keywords
            let topic = "Cá nhân";
            if (content.includes("xã hội") || content.includes("tương tác") || content.includes("giao tiếp")) topic = "Tương tác";
            else if (content.includes("giác quan") || content.includes("vận động") || content.includes("thể chất")) topic = "Vận động";
            else if (content.includes("ngôn ngữ") || content.includes("vocal") || content.includes("âm thanh")) topic = "Ngôn ngữ";
            else if (content.includes("chơi") || content.includes("tập trung") || content.includes("hành vi")) topic = "Hành vi";

            return {
              id: `inv-${idx}`,
              title: inv.title,
              objective: inv.objective,
              steps: inv.steps,
              topic: topic,
              isModelingSuggested: isModeling
            };
          });

          setAnalysis({
            focus: currentDimensions.communication || 75,
            interaction: (currentDimensions.social || 0) > 75 ? "Cao" : "Thấp",
            behavior: (currentDimensions.behavior || 0) > 75 ? "Ổn định" : "Cần chú ý",
            level: calculatedLevel,
            interventions: fetchedInterventions
          });
          
          if (fetchedInterventions.length > 0) {
            setActiveTopic(fetchedInterventions[0].topic);
          }
        } else {
          setAnalysis({
            focus: currentDimensions.communication || 75,
            interaction: (currentDimensions.social || 0) > 75 ? "Cao" : "Thấp",
            behavior: (currentDimensions.behavior || 0) > 75 ? "Ổn định" : "Cần chú ý",
            level: calculatedLevel,
            interventions: []
          });
          setActiveTopic("Tất cả");
        }
      } catch (e) {
        console.error("Failed to load student details:", e);
      }
    }
    loadStudentDetails();

    // Fetch Logs and Trend
    setLogsLoading(true);
    fetch(`/api/child-analysis-log?childId=${encodeURIComponent(selectedStudentId)}`)
      .then((r) => r.json())
      .then(({ logs: l = [], hpdtTrend: t = [] }) => {
        setLogs(l);
        setTrend(t);
      })
      .catch(console.error)
      .finally(() => setLogsLoading(false));
  }, [selectedStudentId]);

  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (sourceFilter !== "all") result = result.filter((l) => l.senderRole === sourceFilter);
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((l) => (l.videoUploadedAt ? new Date(l.videoUploadedAt).getTime() : 0) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000;
      result = result.filter((l) => (l.videoUploadedAt ? new Date(l.videoUploadedAt).getTime() : 0) <= to);
    }
    if (sortOrder === "desc") result = result.reverse();
    return result;
  }, [logs, sortOrder, sourceFilter, dateFrom, dateTo]);

  const REGULATION_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    regulated:     { label: "Điều hòa tốt",     bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
    transitioning: { label: "Đang chuyển tiếp", bg: "bg-amber-100",   text: "text-amber-700",   icon: Activity      },
    dysregulated:  { label: "Mất điều hòa",     bg: "bg-red-100",     text: "text-red-700",     icon: AlertTriangle },
  };

  const SOURCE_CONFIG: any = {
    parent:  { label: "Phụ huynh", bg: "bg-pink-50",   text: "text-pink-600"  },
    teacher: { label: "Giáo viên", bg: "bg-blue-50",   text: "text-blue-600"  },
    admin:   { label: "Hệ thống",  bg: "bg-gray-50",   text: "text-gray-500"  },
  };

  const selectedStudent = useMemo(() => 
    students.find(s => s.id === selectedStudentId), 
  [selectedStudentId, students]);

  const dynamicTopics = useMemo(() => {
    if (!analysis?.interventions || analysis.interventions.length === 0) return [{ id: "Tất cả", label: "Tất cả", icon: Info }];
    const unique = Array.from(new Set(analysis.interventions.map(i => i.topic)));
    return unique.map(topic => {
      let icon = Layout;
      if (topic === "Tương tác") icon = Users;
      else if (topic === "Vận động") icon = Zap;
      else if (topic === "Ngôn ngữ") icon = MessageSquare;
      else if (topic === "Hành vi") icon = Target;
      return { id: topic, label: topic, icon };
    });
  }, [analysis]);

  const currentInterventions = useMemo(() => {
    if (!analysis?.interventions) return [];
    if (activeTopic === "Tất cả") return analysis.interventions;
    return analysis.interventions.filter(inv => inv.topic === activeTopic);
  }, [analysis, activeTopic]);

  const modelingRecommendations = useMemo(() => {
    if (!analysis?.interventions) return [];
    return analysis.interventions.filter(inv => inv.isModelingSuggested);
  }, [analysis]);

  if (loading) {
    return (
      <div className="min-h-screen bg-calming-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      {/* Header */}
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8 border-b border-white/50">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Combo Can Thiệp Tuần</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            AI-Driven Strategy • ABA/VB Methodology
          </p>
        </div>
        <UserMenu userName={userName} role="teacher" avatarInitial="AI" />
      </header>

      {/* Child Selector */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chọn trẻ để can thiệp</h3>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {students.map((student) => (
            <motion.div
              key={student.id}
              onClick={() => setSelectedStudentId(student.id)}
              whileTap={{ scale: 0.95 }}
              className={`flex-shrink-0 w-32 p-4 rounded-[32px] border-2 transition-all cursor-pointer flex flex-col items-center gap-3 ${
                selectedStudentId === student.id
                  ? "bg-white border-orange-200 shadow-premium"
                  : "bg-white/50 border-transparent hover:bg-white"
              }`}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-sm bg-slate-100">
                {student.avatarUrl ? (
                  <img src={student.avatarUrl} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-black text-gray-400">
                    {student.initial}
                  </div>
                )}
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest text-center ${
                selectedStudentId === student.id ? "text-orange-500" : "text-gray-400"
              }`}>
                {student.name}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Analysis Card */}
      <AnimatePresence mode="wait">
        {selectedStudent && (
          <motion.section
            key={selectedStudent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[#1A1C2E] rounded-[48px] p-8 text-white relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Brain className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">Phân Tích Hiện Tại</h2>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Dựa trên dữ liệu có sẵn</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
                <span className="text-[10px] font-black uppercase tracking-widest">Level {analysis?.level || 1}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 relative z-10">
              <div className="bg-white/5 backdrop-blur-md rounded-[32px] p-6 border border-white/5 space-y-2">
                <Zap className="text-orange-400 mb-2" size={18} />
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Tập Trung</p>
                <p className="text-xl font-black">{analysis?.focus || 65}%</p>
              </div>
              <div className="bg-white/5 backdrop-blur-md rounded-[32px] p-6 border border-white/5 space-y-2">
                <Users className="text-blue-400 mb-2" size={18} />
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Tương Tác</p>
                <p className="text-xl font-black">{analysis?.interaction || "Thấp"}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-md rounded-[32px] p-6 border border-white/5 space-y-2">
                <AlertCircle className="text-rose-400 mb-2" size={18} />
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Hành Vi</p>
                <p className="text-xl font-black">{analysis?.behavior || "Cần chú ý"}</p>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Parent Videos Section */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Video từ phụ huynh gửi</h3>
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{parentVideos.length} Video mới</span>
        </div>

        {parentVideos.length > 0 ? (
          <div className="grid grid-cols-2 gap-6">
            {parentVideos.map((video) => (
              <motion.div
                key={video.id}
                whileHover={{ y: -5 }}
                className="bg-white rounded-[40px] overflow-hidden shadow-soft border border-gray-100 group"
              >
                <div className="aspect-video relative overflow-hidden bg-slate-100">
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-gray-900 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100">
                      <Play fill="currentColor" size={20} />
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h4 className="font-black text-gray-900 line-clamp-1">{video.title}</h4>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                    {video.createdAt?.toDate ? new Intl.DateTimeFormat('vi-VN').format(video.createdAt.toDate()) : "Vừa xong"}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-[40px] p-12 text-center">
            <Video className="mx-auto text-gray-300 mb-3" size={32} />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Chưa có video mới từ phụ huynh</p>
          </div>
        )}
      </section>

      {/* Analysis Reports Library (New) */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
              <Brain size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Thư viện phân tích</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                Hồ sơ tiến độ của {selectedStudent?.name}
              </p>
            </div>
          </div>
          <div className="px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tổng</p>
            <p className="text-2xl font-black text-indigo-600">{logs.length}</p>
          </div>
        </div>

        {/* Trend Chart */}
        {trend.length >= 2 && (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 tracking-tight">Tiến độ HPDT theo thời gian</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Dựa theo ngày upload video</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: "bold" }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: "bold" }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                    labelStyle={{ fontSize: "12px", color: "#64748b", marginBottom: "4px", fontWeight: "bold" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px", fontWeight: "bold", paddingTop: "10px" }} />
                  <Line type="monotone" name="Tổng thể" dataKey="overall" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Xã hội" dataKey="social" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Nhận thức" dataKey="cognitive" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Hành vi" dataKey="behavior" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Giác quan" dataKey="sensory" stroke="#ec4899" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Vận động" dataKey="motor" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-gray-50 rounded-2xl p-1 gap-1">
              <button onClick={() => setSortOrder("desc")} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${sortOrder === "desc" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400"}`}>
                <SortDesc className="w-3.5 h-3.5" /> Mới nhất
              </button>
              <button onClick={() => setSortOrder("asc")} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${sortOrder === "asc" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400"}`}>
                <SortAsc className="w-3.5 h-3.5" /> Cũ nhất
              </button>
            </div>
            <div className="flex items-center bg-gray-50 rounded-2xl p-1 gap-1">
              {(["all", "parent", "teacher"] as const).map((s) => (
                <button key={s} onClick={() => setSourceFilter(s)} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${sourceFilter === s ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400"}`}>
                  {s === "all" ? "Tất cả" : s === "parent" ? "Phụ huynh" : "Giáo viên"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="flex-1 text-xs font-bold text-gray-700 bg-gray-50 rounded-2xl px-4 py-2.5 border-none" />
            <span className="text-xs text-gray-300">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="flex-1 text-xs font-bold text-gray-700 bg-gray-50 rounded-2xl px-4 py-2.5 border-none" />
          </div>
        </div>

        {/* Log Cards List */}
        <div className="space-y-6">
          {logsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>
          ) : filteredLogs.map((log, idx) => {
            const reg = REGULATION_CONFIG[log.regulationLevel] || REGULATION_CONFIG.transitioning;
            const src = SOURCE_CONFIG[log.senderRole] || SOURCE_CONFIG.teacher;
            return (
              <motion.div key={log.analysisId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{log.videoUploadedAt ? new Date(log.videoUploadedAt).toLocaleDateString("vi-VN") : "—"}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${src.bg} ${src.text}`}>{src.label}</span>
                        </div>
                        <h4 className="font-black text-gray-900 mt-1">{log.videoTopic || "Phân tích không tên"}</h4>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-1 ${reg.bg} ${reg.text}`}>
                      <reg.icon size={14} /> {reg.label}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1.5">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">HPDT Tổng thể</span>
                          <span className="text-lg font-black text-indigo-700">{log.hpdt.overall}/100</span>
                        </div>
                        <div className="h-3 bg-indigo-50 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" initial={{ width: 0 }} animate={{ width: `${log.hpdt.overall}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-400 shrink-0">{log.lessonCount} bài học</span>
                    </div>

                    <div className="bg-indigo-50 rounded-2xl p-4 text-xs font-bold text-indigo-700 flex items-start gap-3">
                      <Sparkles size={16} className="shrink-0 text-indigo-500 mt-0.5" />
                      <p>{log.keyInsights?.[0] || "Đang cập nhật nhận định AI..."}</p>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t border-gray-50">
                       <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                          <FileText size={12} /> {log.fileName}
                       </div>
                       <a href={`/api/generate-report?analysisId=${log.analysisId}`} target="_blank" className="ml-auto flex items-center gap-2 px-6 py-3 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all">
                          <FileDown size={14} /> Tải PDF
                       </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
