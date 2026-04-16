"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Brain, Target, UserCheck, Accessibility, Award, FileText, Sparkles } from "lucide-react";
import HPDTRadar from "@/components/hpdt/HPDTRadar";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { resolveLearnerForParent } from "@/lib/services/learnerService";
import {
  formatFirestoreLikeDate,
  normalizeWordInsights,
  type LatestWordInsights,
} from "@/lib/word-insights";

export default function HPDTPage() {
  const [hpdtValue, setHpdtValue] = useState(75);
  const [childName, setChildName] = useState("bé");
  const [wordInsights, setWordInsights] = useState<LatestWordInsights | null>(null);
  const [skillData, setSkillData] = useState([
    { skill: "Nhận thức", value: 65, fullMark: 100 },
    { skill: "Giác quan", value: 85, fullMark: 100 },
    { skill: "Vận động", value: 75, fullMark: 100 },
    { skill: "Hành vi", value: 60, fullMark: 100 },
    { skill: "Xã hội", value: 90, fullMark: 100 },
  ]);
  const [loading, setLoading] = useState(true);

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
        const preferredChildId =
          userSnap.exists() && typeof userSnap.data().childId === "string"
            ? userSnap.data().childId
            : undefined;

        const learner = await resolveLearnerForParent(userId, preferredChildId);
        if (!learner || !isActive) {
          setLoading(false);
          return;
        }

        setChildName(learner.name || "bé");

        unsub = onSnapshot(doc(db, learner.source, learner.id), (docSnap) => {
          if (!docSnap.exists()) {
            setLoading(false);
            return;
          }

          const data = docSnap.data();
          setHpdtValue(data.hpdt || 75);
          if (typeof data.name === "string" && data.name.trim()) {
            setChildName(data.name);
          }

          setWordInsights(normalizeWordInsights(data.latestWordInsights));

          // Map dynamic variables from the most recent AI analyses
          setSkillData([
            { skill: "Nhận thức", value: data.cognitive || 65, fullMark: 100 },
            { skill: "Giác quan", value: data.sensory || 85, fullMark: 100 },
            { skill: "Vận động", value: data.motor || 75, fullMark: 100 },
            { skill: "Hành vi", value: data.behavior || 60, fullMark: 100 },
            { skill: "Xã hội", value: data.social || 90, fullMark: 100 },
          ]);

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

  const skillGrids = [
    { label: "GIAO TIẾP", status: hpdtValue > 80 ? "Xuất sắc" : "Khá", color: "text-blue-600", bg: "bg-blue-50/50", icon: Target },
    { label: "TỰ PHỤC VỤ", status: "Trung bình", color: "text-purple-600", bg: "bg-purple-50/50", icon: UserCheck },
    { label: "XÃ HỘI", status: "Tiến bộ", color: "text-green-600", bg: "bg-green-50/50", icon: Accessibility },
    { label: "VẬN ĐỘNG", status: "Tốt", color: "text-orange-600", bg: "bg-orange-50/50", icon: Award },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-calming-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="flex items-center gap-4">
        <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Brain size={24} className="text-primary" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">Bản sao số (hpDT) của {childName}</h1>
      </header>

      {/* Main Gauge & Radar Section */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-[40px] p-10 shadow-premium border border-gray-50 flex flex-col items-center space-y-12"
      >
        <div className="relative w-56 h-56 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="112" cy="112" r="96"
              fill="transparent"
              stroke="#F8FAFC"
              strokeWidth="28"
            />
            <motion.circle
              cx="112" cy="112" r="96"
              fill="transparent"
              stroke="#4F46E5"
              strokeWidth="28"
              strokeDasharray={2 * Math.PI * 96}
              initial={{ strokeDashoffset: 2 * Math.PI * 96 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 96 * (1 - hpdtValue / 100) }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
              className="drop-shadow-[0_0_15px_rgba(79,70,229,0.3)]"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl font-black text-gray-900 tracking-tighter">{hpdtValue}%</span>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Hòa nhập</span>
          </div>
        </div>

        {/* Skill Radar Chart */}
        <div className="w-full border-t border-gray-50 pt-10">
          <HPDTRadar data={skillData} />
        </div>

        {/* Grid Status (Simplified for Image 2 feel) */}
        <div className="grid grid-cols-2 gap-6 w-full">
          {skillGrids.map((skill, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ y: -4 }}
              className={`${skill.bg} border border-white p-6 rounded-[32px] space-y-2 group transition-all`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-black uppercase tracking-widest ${skill.color}`}>{skill.label}</span>
                <skill.icon size={16} className={`${skill.color} opacity-30`} />
              </div>
              <p className="text-xl font-black text-gray-900 leading-tight">{skill.status}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.section
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border border-gray-100 rounded-[32px] p-8 space-y-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Word Intake</p>
              <h3 className="text-lg font-black text-gray-900">Tổng quan chỉ số từ hồ sơ Word</h3>
            </div>
          </div>
          {wordInsights ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {formatFirestoreLikeDate(wordInsights.updatedAt)}
            </span>
          ) : null}
        </div>

        {wordInsights ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Tổng quan</p>
                <p className="text-2xl font-black text-indigo-900 mt-1">{wordInsights.indicators.overall}%</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Tin cậy</p>
                <p className="text-2xl font-black text-emerald-900 mt-1">{wordInsights.indicators.confidence}%</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 col-span-2 sm:col-span-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Nguồn</p>
                <p className="text-xs font-bold text-amber-900 mt-2 line-clamp-2">
                  {wordInsights.fileName || "Hồ sơ Word mới nhất"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Giao tiếp", value: wordInsights.indicators.communication },
                { label: "Xã hội", value: wordInsights.indicators.social },
                { label: "Hành vi", value: wordInsights.indicators.behavior },
                { label: "Giác quan", value: wordInsights.indicators.sensory },
                { label: "Vận động", value: wordInsights.indicators.motor },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                    <span>{item.label}</span>
                    <span>{item.value}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {wordInsights.interventionLessons.length > 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles size={16} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Bài can thiệp gợi ý từ hồ sơ</p>
                </div>
                <ul className="space-y-2">
                  {wordInsights.interventionLessons.slice(0, 3).map((lesson, index) => (
                    <li key={`${lesson.title}-${index}`} className="text-sm text-gray-700">
                      <strong className="text-gray-900">{lesson.title}:</strong> {lesson.description}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm font-semibold text-gray-400 text-center">
            Chưa có dữ liệu hồ sơ Word cho bé này. Sau khi Admin nạp tài liệu, chỉ số sẽ xuất hiện ở đây.
          </div>
        )}
      </motion.section>

      {/* VST Transfer Notes Card */}
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-[#FFFBEB] border border-amber-100 rounded-[32px] p-8 space-y-4"
      >
        <div className="flex items-center gap-3 text-amber-700">
          <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center">
            <AlertCircle size={22} className="text-amber-600" />
          </div>
          <h3 className="font-black text-xs uppercase tracking-[0.2em]">Ghi chú chuyển giao (VST)</h3>
        </div>
        <p className="text-base text-amber-900 leading-relaxed font-bold tracking-tight px-2">
          Bé đang tiến hóa nhanh ở mảng Xã hội. VST khuyến nghị chuẩn bị hồ sơ chuyển giao sang lớp hòa nhập sớm hơn 2 tháng so với kế hoạch ban đầu.
        </p>
      </motion.div>
    </div>
  );
}
