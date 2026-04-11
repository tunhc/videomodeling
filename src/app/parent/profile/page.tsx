"use client";

import { motion } from "framer-motion";
import { User, Calendar, MapPin, Shield, Brain, Heart, ChevronRight, Settings, LogOut, Bell, FileText } from "lucide-react";

export default function ProfilePage() {
  const childInfo = {
    name: "Minh Khôi",
    id: "MK-202",
    age: "4.5 tuổi",
    diagnosis: "Tự kỷ điển hình - Mức độ 2",
    school: "Trường Chuyên biệt Bình Minh",
    baseline: 40,
    current: 75,
  };

  const sections = [
    { label: "Báo cáo y tế & Hồ sơ gốc", icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Lịch sử can thiệp", icon: Calendar, color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Cài đặt thông báo", icon: Bell, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "Quyền riêng tư & Bảo mật", icon: Shield, color: "text-emerald-500", bg: "bg-emerald-50" },
  ];

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Hồ sơ của bé</h1>
        <button className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-400">
          <Settings size={22} />
        </button>
      </header>

      {/* Main Profile Card */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[40px] p-10 shadow-premium border border-gray-50 space-y-8 relative overflow-hidden"
      >
        <div className="flex items-center gap-8">
          <div className="relative">
            <div className="w-24 h-24 bg-indigo-50 border-4 border-white rounded-[32px] flex items-center justify-center text-3xl font-black text-primary shadow-hpdt">
              K
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 border-4 border-white rounded-2xl flex items-center justify-center text-white">
              <Shield size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">{childInfo.name}</h2>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <span>{childInfo.id}</span>
              <span className="text-gray-200">|</span>
              <span>{childInfo.age}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-4">
            <MapPin size={18} className="text-primary" />
            <p className="text-sm font-bold text-gray-600">{childInfo.school}</p>
          </div>
          <div className="flex items-center gap-4">
            <Brain size={18} className="text-primary" />
            <p className="text-sm font-bold text-gray-600">{childInfo.diagnosis}</p>
          </div>
        </div>

        {/* hpDT Progress Summary */}
        <div className="bg-indigo-50/50 p-8 rounded-[32px] border border-white flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Tiến độ hpDT</p>
            <p className="text-2xl font-black text-gray-900 tracking-tighter">PHÁT TRIỂN TỐT</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-primary tracking-tighter">{childInfo.current}%</p>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">tăng +35% từ Baseline</p>
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
