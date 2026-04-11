"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { School, Users, Utensils, Brain, Video, Lightbulb, Hash } from "lucide-react";

export default function ActivitiesPage() {
  const [activeTab, setActiveTab] = useState("Lớp Học");

  const tabs = [
    { id: "Lớp Học", icon: School },
    { id: "Sân Chơi & Nhóm", icon: Users },
    { id: "Nhà Ăn", icon: Utensils },
    { id: "Phòng Đặc Biệt", icon: Brain },
  ];

  const activities = [
    {
      id: 1,
      category: "Lớp Học",
      type: "VẬN ĐỘNG",
      title: "Thực hành vận động tinh (Viết/Vẽ)",
      angle: "Cận cảnh bàn tay",
      tip: "Quay ngang vai để thấy cách cầm bút.",
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      id: 2,
      category: "Lớp Học",
      type: "GIAO TIẾP",
      title: "Tương tác có nhu cầu với Giáo viên",
      angle: "Ngang tầm mắt",
      tip: "Làm mẫu việc giơ tay và nói 'Con thưa cô'.",
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      id: 3,
      category: "Lớp Học",
      type: "TỰ PHỤC VỤ",
      title: "Tự phục vụ: Dọn dẹp bàn học",
      angle: "Góc rộng",
      tip: "Quay trình tự: Cất bút -> Đóng vở -> Đẩy ghế.",
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      id: 4,
      category: "Lớp Học",
      type: "CẢM XÚC",
      title: "Nhận biết cảm xúc bạn bè",
      angle: "Chính diện (AI)",
      tip: "Bạn mẫu thể hiện nét mặt vui/buồn khi chia sẻ đồ.",
      color: "text-mint",
      bg: "bg-green-50",
    },
  ];

  return (
    <div className="p-6 space-y-8 bg-calming-bg min-h-screen">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          🏫 Phân Loại Tình Huống
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed font-medium">
          Tại trường, hành vi của trẻ thay đổi tùy theo không gian và đối tượng tương tác. Hãy chọn một khu vực dưới đây để xem chi tiết...
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl whitespace-nowrap transition-all border ${
              activeTab === tab.id 
                ? 'bg-primary text-white border-primary shadow-premium scale-105' 
                : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={18} />
            <span className="text-xs font-bold">{tab.id}</span>
          </button>
        ))}
      </div>

      {/* Activity Grid */}
      <div className="grid grid-cols-1 gap-6 pb-20">
        <AnimatePresence mode="wait">
          {activities
            .filter(a => a.category === activeTab)
            .map((activity) => (
              <motion.div 
                key={activity.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="bg-white rounded-4xl p-8 shadow-premium border border-gray-50 space-y-6 relative overflow-hidden"
              >
                <div className="absolute right-6 top-6 text-gray-100">
                  <Hash size={32} />
                </div>

                <div className="space-y-4">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase ${activity.bg} ${activity.color}`}>
                    {activity.type}
                  </span>
                  <h3 className="text-lg font-extrabold text-gray-800">{activity.title}</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-2xl p-4 flex gap-4">
                    <Video className="text-gray-400" size={20} />
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Góc Quay</p>
                      <p className="text-sm font-medium text-gray-700">{activity.angle}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-50 rounded-2xl p-4 flex gap-4">
                    <Lightbulb className="text-yellow-500" size={20} />
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Mẹo AI</p>
                      <p className="text-sm font-medium text-blue-900 leading-relaxed">{activity.tip}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
