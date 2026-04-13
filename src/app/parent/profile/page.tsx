"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Calendar, MapPin, Shield, Brain, Heart, ChevronRight, Settings, LogOut, Bell, FileText, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { resolveLearnerForParent } from "@/lib/services/learnerService";

export default function ProfilePage() {
  const [childData, setChildData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setLoading(false);
      return;
    }

    async function loadProfile() {
      try {
        const userSnap = await getDoc(doc(db, "users", userId as string));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserProfile(userData);

          const learner = await resolveLearnerForParent(userId as string, userData.childId);
          if (learner) {
            setChildData(learner);
          }
        }
      } catch (e) {
        console.error("Error loading profile:", e);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-calming-bg">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const sections = [
    { label: "Báo cáo y tế & Hồ sơ gốc", icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Lịch sử can thiệp", icon: Calendar, color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Cài đặt thông báo", icon: Bell, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "Quyền riêng tư & Bảo mật", icon: Shield, color: "text-emerald-500", bg: "bg-emerald-50" },
  ];

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8 space-y-1">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Hồ sơ của bé</h1>
        {childData && (
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Phụ huynh của {childData.name}</p>
        )}
      </header>

      {/* Main Profile Card */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[40px] p-10 shadow-premium border border-gray-50 space-y-8 relative overflow-hidden"
      >
        <div className="flex items-center gap-8">
          <div className="relative">
            <div className="w-24 h-24 bg-indigo-50 border-4 border-white rounded-[32px] flex items-center justify-center text-3xl font-black text-primary shadow-hpdt uppercase">
              {childData?.name?.charAt(0) || "K"}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 border-4 border-white rounded-2xl flex items-center justify-center text-white">
              <Shield size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">{childData?.name || "Hồ sơ của bé"}</h2>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <span>{childData?.id}</span>
              <span className="text-gray-200">|</span>
              <span>
                {childData?.birthday ? `${new Date().getFullYear() - new Date(childData.birthday).getFullYear()} tuổi` : "Chưa cập nhật"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-4">
            <MapPin size={18} className="text-primary" />
            <p className="text-sm font-bold text-gray-600">Kim Bình Center - TPHCM</p>
          </div>
          <div className="flex items-center gap-4">
            <Brain size={18} className="text-primary" />
            <p className="text-sm font-bold text-gray-600">{childData?.diagnosis || "Đang cập nhật chẩn đoán"}</p>
          </div>
        </div>

        {/* hpDT Progress Summary */}
        <div className="bg-indigo-50/50 p-8 rounded-[32px] border border-white flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Tiến độ hpDT</p>
            <p className="text-2xl font-black text-gray-900 tracking-tighter uppercase">
              {childData?.hpdt >= 70 ? "Phát triển tốt" : childData?.hpdt >= 40 ? "Đang tiến triển" : "Cần hỗ trợ"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-primary tracking-tighter">{childData?.hpdt || 0}%</p>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Score mới nhất</p>
          </div>
        </div>
      </motion.div>

      {/* Menu Sections */}
      <div className="space-y-4">
        {sections.map((section, idx) => (
          <motion.button 
            key={idx}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
            className={`w-full bg-white border border-gray-50 p-6 rounded-[32px] flex items-center justify-between shadow-soft hover:shadow-premium transition-all group`}
          >
            <div className="flex items-center gap-5">
              <div className={`w-12 h-12 ${section.bg} ${section.color} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                <section.icon size={22} />
              </div>
              <span className="text-sm font-black text-gray-700 tracking-tight">{section.label}</span>
            </div>
            <ChevronRight size={20} className="text-gray-200 group-hover:text-primary transition-colors" />
          </motion.button>
        ))}
      </div>

      <button className="w-full py-6 flex items-center justify-center gap-3 text-red-400 font-extrabold text-xs uppercase tracking-[0.2em] opacity-50 hover:opacity-100 transition-opacity">
        <LogOut size={18} /> Đăng xuất tài khoản
      </button>
    </div>
  );
}
