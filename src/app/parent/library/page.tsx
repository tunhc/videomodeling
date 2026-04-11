"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, BookOpen, Clock, Tag, PlayCircle, BookCheck } from "lucide-react";

export default function LibraryPage() {
  const [activeFilter, setActiveFilter] = useState("Tất cả");

  const filters = ["Tất cả", "0-3 tuổi", "3-6 tuổi", "Giao tiếp", "Giác quan", "Hành vi"];

  const articles = [
    { title: "Kỹ năng chào hỏi cơ bản qua Video Modeling", group: "Giao tiếp", age: "0-3 tuổi", time: "5 phút", hasVideo: true },
    { title: "Cách xử lý cơn bùng nổ cảm xúc tại nơi công cộng", group: "Hành vi", age: "Tất cả", time: "8 phút", hasVideo: false },
    { title: "Bài tập phối hợp mắt và tay đơn giản tại nhà", group: "Giác quan", age: "0-3 tuổi", time: "10 phút", hasVideo: true },
    { title: "Phương pháp PECS trong giao tiếp sớm", group: "Giao tiếp", age: "3-6 tuổi", time: "15 phút", hasVideo: false },
    { title: "Huấn luyện trẻ tự đi vệ sinh (Toilet Training)", group: "Hành vi", age: "3-6 tuổi", time: "12 phút", hasVideo: true },
  ];

  const filteredArticles = activeFilter === "Tất cả" 
    ? articles 
    : articles.filter(a => a.group === activeFilter || a.age === activeFilter);

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Thư viện AI</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Bài giảng & Hướng dẫn chuyên môn</p>
        </div>
        <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-primary">
          <BookOpen size={24} />
        </div>
      </header>

      {/* Search & Filter */}
      <div className="space-y-6">
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
          <input 
            type="text" 
            placeholder="Tìm kiếm bài giảng, chủ đề..." 
            className="w-full bg-white border border-gray-100 focus:border-primary/20 rounded-[32px] py-6 px-14 text-sm font-bold tracking-tight outline-none shadow-soft transition-all"
          />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 -mx-8 px-8 no-scrollbar">
          {filters.map(filter => (
            <button 
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 ${
                activeFilter === filter 
                  ? 'bg-primary border-primary text-white shadow-hpdt' 
                  : 'bg-white border-gray-50 text-gray-400'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Article List */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredArticles.map((article, idx) => (
            <motion.div 
              key={article.title}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-[40px] p-8 border border-gray-50 shadow-soft hover:shadow-premium transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black bg-indigo-50 text-primary px-3 py-1 rounded-full uppercase tracking-widest leading-none">
                      {article.group}
                    </span>
                    <span className="text-[8px] font-black bg-gray-50 text-gray-400 px-3 py-1 rounded-full uppercase tracking-widest leading-none">
                      {article.age}
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-gray-900 leading-tight tracking-tight pt-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </h4>
                </div>
                {article.hasVideo ? (
                  <div className="p-3 bg-red-50 text-red-500 rounded-2xl shadow-sm">
                    <PlayCircle size={24} />
                  </div>
                ) : (
                  <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl shadow-sm">
                    <BookCheck size={24} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Clock size={14} /> {article.time}</span>
                  <span className="text-gray-200">|</span>
                  <span>AI Generated</span>
                </div>
                {!article.hasVideo && (
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">Sắp có video</span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredArticles.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <BookOpen size={48} className="mx-auto text-gray-200" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Chưa có bài giảng trong mục này</p>
        </div>
      )}
    </div>
  );
}
