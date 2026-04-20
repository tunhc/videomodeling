"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, Target, Award, Calendar, Zap, 
  TrendingUp, Sparkles, MessageSquare, 
  Heart, Users, Info, ChevronRight,
  CheckCircle2,
  Clock,
  Loader2
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { resolveLearnerForParent } from "@/lib/services/learnerService";
import {
  formatFirestoreLikeDate,
  normalizeWordInsights,
  type LatestWordInsights,
} from "@/lib/word-insights";

// Mock trend data for the 4 skill lines
const trendData = [
  { day: 'Thứ 2', communication: 65, focus: 55, emotion: 70, social: 60 },
  { day: 'Thứ 3', communication: 68, focus: 58, emotion: 72, social: 65 },
  { day: 'Thứ 4', communication: 66, focus: 62, emotion: 70, social: 64 },
  { day: 'Thứ 5', communication: 75, focus: 60, emotion: 75, social: 70 },
  { day: 'Thứ 6', communication: 72, focus: 65, emotion: 73, social: 72 },
  { day: 'Thứ 7', communication: 82, focus: 64, emotion: 74, social: 78 },
  { day: 'CN', communication: 85, focus: 65, emotion: 75, social: 80 },
];

export default function HPDTPage() {
  const [hpdtValue, setHpdtValue] = useState(75);
  const [childName, setChildName] = useState("bé");
  const [wordInsights, setWordInsights] = useState<LatestWordInsights | null>(null);
  const [loading, setLoading] = useState(true);

  // Real Stats States
  const [overallScore, setOverallScore] = useState(75); // Default to 75 to match homepage for now
  const [activeDays, setActiveDays] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let isActive = true;

    async function bindLearner() {
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) {
          setLoading(false);
          return;
        }

        const userSnap = await getDoc(doc(db, "users", userId));
        const profile = userSnap.exists() ? userSnap.data() : {};

        const preferredChildId = profile.childId || undefined;
        const learner = await resolveLearnerForParent(userId, preferredChildId);
        
        if (!learner || !isActive) {
          setLoading(false);
          return;
        }

        const childId = learner.id;
        setChildName(learner.name || "bé");

        // 1. Fetch HPDT Stats (Overall Score) - Try multiple sources
        let finalScore = 75; // Fallback default

        // First check hpdt_stats collection
        const statsRef = doc(db, "hpdt_stats", childId);
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) {
          const sData = statsSnap.data();
          finalScore = sData.overallScore || sData.overall || finalScore;
        } else {
          // Try searching by childId field if docId is not childId
          const statsQuery = query(collection(db, "hpdt_stats"), where("childId", "==", childId));
          const statsResult = await getDocs(statsQuery);
          if (!statsResult.empty) {
            const data = statsResult.docs[0].data();
            finalScore = data.overallScore || data.overall || finalScore;
          }
        }

        // If still no score, check the learner document itself
        if (finalScore === 75) {
            const learnerSnap = await getDoc(doc(db, learner.source, childId));
            if (learnerSnap.exists()) {
                const lData = learnerSnap.data();
                finalScore = lData.hpdt || finalScore;
            }
        }

        setOverallScore(finalScore);
        setHpdtValue(finalScore);

        // 2. Calculate Active Days (based on video uploads)
        const videoQuery = query(collection(db, "video_analysis"), where("childId", "==", childId));
        const videoSnap = await getDocs(videoQuery);
        const uniqueDates = new Set();
        videoSnap.forEach(doc => {
          const data = doc.data();
          const date = data.createdAt?.toDate() || new Date();
          uniqueDates.add(date.toDateString());
        });
        setActiveDays(uniqueDates.size);

        // 3. Count Badges (Completed goals in exercise_logs)
        const badgeQuery = query(
          collection(db, "exercise_logs"), 
          where("childId", "==", childId),
          where("status", "==", "parent_done")
        );
        const badgeSnap = await getDocs(badgeQuery);
        setBadgeCount(badgeSnap.size);

        // Listen for realtime updates on child document
        unsub = onSnapshot(doc(db, learner.source, childId), (docSnap) => {
          if (!docSnap.exists()) {
            setLoading(false);
            return;
          }

          const data = docSnap.data();
          if (typeof data.name === "string" && data.name.trim()) {
            setChildName(data.name);
          }
          
          // Sync HPDT if it's updated in learner doc
          if (data.hpdt) {
            setOverallScore(prev => data.hpdt || prev);
            setHpdtValue(prev => data.hpdt || prev);
          }

          setWordInsights(normalizeWordInsights(data.latestWordInsights));
          setLoading(false);
        });
      } catch (error) {
        console.error("Failed to load hpDT child:", error);
        setLoading(false);
      }
    }

    bindLearner();
    return () => {
      isActive = false;
      if (unsub) unsub();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-[#F8FAFC] min-h-screen pb-32">
      <header className="space-y-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Phân tích & Tiến độ</h1>
        <p className="text-slate-500 font-medium">Theo dõi sự phát triển của {childName} qua thời gian</p>
      </header>

      {/* Top Level Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chỉ số phát triển</p>
            <div className="flex items-end gap-2">
              <h3 className="text-3xl font-black text-slate-900 leading-none">{overallScore}%</h3>
              <span className="text-emerald-500 font-black text-sm mb-1">+{Math.max(0, overallScore - 70)}%</span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">Dựa trên hpDT Stats</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Calendar size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ngày hoạt động</p>
            <div className="flex items-end gap-1">
              <h3 className="text-3xl font-black text-slate-900 leading-none">{activeDays}</h3>
              <span className="text-slate-400 font-bold text-sm mb-1">/tháng</span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">Dựa trên lịch sử upload</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <Award size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Huy hiệu đạt được</p>
            <div className="flex items-end gap-1">
              <h3 className="text-3xl font-black text-slate-900 leading-none">{badgeCount}</h3>
              <span className="text-emerald-500 font-bold text-sm mb-1">Huy hiệu</span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">Mục tiêu đã hoàn thành</p>
          </div>
        </motion.div>
      </div>

      {/* Main Analysis Chart Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 flex flex-col space-y-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Biểu đồ tiến độ tổng quát</h3>
              <div className="flex items-center gap-2">
                <Info size={12} className="text-slate-300" />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Dựa trên nhật ký và tương tác AI</p>
              </div>
            </div>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-xl">
            <button className="px-4 py-1.5 bg-white shadow-sm rounded-lg text-xs font-black text-slate-900">Tuần này</button>
            <button className="px-4 py-1.5 text-xs font-bold text-slate-400">Tháng này</button>
          </div>
        </div>

        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 'bold' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 'bold' }} 
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              <Line type="monotone" dataKey="communication" name="Giao tiếp" stroke="#4F46E5" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="focus" name="Tập trung" stroke="#F59E0B" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="emotion" name="Cảm xúc" stroke="#EC4899" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="social" name="Xã hội" stroke="#10B981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Skills & Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Skill Progress Bars */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100 space-y-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Brain size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900">Kỹ năng phát triển</h3>
          </div>

          <div className="space-y-6">
            {[
              { label: "Giao tiếp", value: 85, color: "bg-indigo-500" },
              { label: "Tập trung", value: 65, color: "bg-amber-500" },
              { label: "Cảm xúc", value: 75, color: "bg-rose-500" },
              { label: "Xã hội", value: 80, color: "bg-emerald-500" },
            ].map((skill) => (
              <div key={skill.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600">{skill.label}</span>
                  <span className="text-sm font-black text-slate-900">{skill.value}%</span>
                </div>
                <div className="h-3 bg-slate-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${skill.value}%` }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className={`h-full ${skill.color} rounded-full`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* AI Driven Goals */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100 space-y-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
              <Sparkles size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900">Mục tiêu sắp tới</h3>
          </div>

          <div className="space-y-4">
            {(wordInsights?.interventionLessons?.length ? wordInsights.interventionLessons.slice(0, 3) : [
              { title: "Cải thiện khả năng tập trung", description: "Thực hiện 3 bài tập chánh niệm mỗi tuần" },
              { title: "Giao tiếp xã hội", description: "Tham gia 2 buổi chơi nhóm cùng bạn bè" },
              { title: "Quản lý cảm xúc", description: "Nhận diện 5 loại cảm xúc cơ bản" }
            ]).map((goal: any, idx: number) => (
              <div key={idx} className={`p-5 rounded-3xl border transition-all ${idx === 0 ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${idx === 0 ? 'border-indigo-400 text-indigo-500' : 'border-slate-300 text-slate-400'}`}>
                    {idx === 0 ? <Zap size={14} fill="currentColor" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 leading-tight">{goal.title}</h4>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">{goal.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Digital Twin Display (Preserved & Unified) */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100 flex flex-col items-center justify-center space-y-8"
      >
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Bản sao số (hpDT) của {childName}</p>
        <div className="relative w-56 h-56 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-slate-50 rounded-full" />
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="112" cy="112" r="96"
              fill="transparent"
              stroke="#F8FAFC"
              strokeWidth="24"
            />
            <motion.circle
              cx="112" cy="112" r="96"
              fill="transparent"
              stroke="url(#hpdtGradient)"
              strokeWidth="24"
              strokeDasharray={2 * Math.PI * 96}
              initial={{ strokeDashoffset: 2 * Math.PI * 96 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 96 * (1 - hpdtValue / 100) }}
              transition={{ duration: 2, ease: "easeOut" }}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="hpdtGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#9333EA" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl font-black text-slate-900 tracking-tighter">{hpdtValue}%</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Hòa nhập</span>
          </div>
        </div>
        <p className="text-slate-500 font-medium text-sm text-center max-w-md italic">
          "Bé đang thể hiện sự tập trung cao hơn khi thực hiện các bài tập vận động thô trong tuần qua."
        </p>
      </motion.div>
    </div>
  );
}
