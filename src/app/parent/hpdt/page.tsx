"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Brain, Target, UserCheck, Accessibility, Award } from "lucide-react";
import HPDTRadar from "@/components/hpdt/HPDTRadar";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { resolveLearnerForParent } from "@/lib/services/learnerService";

export default function HPDTPage() {
  const [hpdtValue, setHpdtValue] = useState(75);
  const [childName, setChildName] = useState("bé");
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
