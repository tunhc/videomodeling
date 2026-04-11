"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Clock, Sparkles } from "lucide-react";

export default function InterventionPage() {
  const timeline = [
    { time: "08:30", title: "Chào hỏi & Vòng tròn", status: "completed", participants: "12/12" },
    { time: "09:15", title: "Trị liệu cá nhân (Video Modeling)", status: "upcoming", participants: "4/12", active: true },
    { time: "10:30", title: "Kỹ năng hòa nhập nhóm", status: "upcoming", participants: "0/12" },
  ];

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Combo Can Thiệp</h1>
        <button className="bg-blue-50 text-blue-600 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
          Hôm nay
        </button>
      </header>

      {/* Timeline */}
      <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-indigo-100">
        {timeline.map((item, idx) => (
          <motion.div 
            key={idx}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="flex gap-8 items-start relative pl-2"
          >
            {/* Timeline Dot */}
            <div className={`absolute left-[-2px] w-3 h-3 rounded-full border-2 border-white z-10 ${item.active ? 'bg-primary scale-125' : 'bg-indigo-200'}`}></div>

            <div className={`text-[11px] font-black mt-1.5 w-12 ${item.active ? 'text-primary' : 'text-gray-400'}`}>
              {item.time}
            </div>
            
            <div className={`flex-1 p-6 rounded-[32px] border transition-all ${
              item.active 
                ? 'bg-white border-primary/20 shadow-premium scale-[1.02]' 
                : 'bg-white border-gray-100'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <h4 className={`text-lg font-extrabold ${item.status === 'completed' ? 'text-gray-300' : 'text-gray-900'}`}>
                  {item.title}
                </h4>
                {item.status === 'completed' ? (
                  <CheckCircle2 size={24} className="text-green-400" />
                ) : (
                  <Clock size={24} className="text-gray-200" />
                )}
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span> Sĩ số tham gia: {item.participants}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* VST AI Reminder Bubble (Matching Image 4) */}
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-primary rounded-[40px] p-10 text-white relative shadow-hpdt overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Sparkles size={160} />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400/20 rounded-2xl flex items-center justify-center">
              <Sparkles size={24} className="text-yellow-400 fill-yellow-400" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/90">Trợ lý VST nhắc nhở</h3>
          </div>
          <p className="text-lg leading-relaxed font-bold tracking-tight">
            "Cô ơi, hôm nay Minh Khôi đã hoàn thành tốt bài tập Video Modeling tại nhà (do mẹ gửi lên). Tiết trị liệu cá nhân lúc 09:15, cô có thể bỏ qua bước khởi động để tiến thẳng tới mục tiêu Phát âm âm đôi nhé!"
          </p>
        </div>
      </motion.div>
    </div>
  );
}
