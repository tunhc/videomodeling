"use client";

import { motion } from "framer-motion";
import { TrendingUp, Award, AlertCircle, Brain, Target, ArrowUpRight, Zap, Bell, Sparkles } from "lucide-react";

export default function MonitorPage() {
  const stats = [
    { label: "hpDT Tăng trưởng", value: "+12.4%", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "AI Thành công", value: "85%", icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Combo Hoàn thành", value: "24", icon: Award, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const predictions = [
    { name: "Minh Khôi", status: "Ổn định", prediction: "Có xu hướng tích cực", confidence: 92, nextAction: "Tăng độ khó giao tiếp" },
    { name: "Hoàng Anh", status: "Căng thẳng nhẹ", prediction: "Nguy cơ kích động cao", confidence: 78, nextAction: "Thực hiện Combo Thở", alert: true },
    { name: "Ngọc Lan", status: "Tiến bộ", prediction: "Sẵn sàng hòa nhập", confidence: 95, nextAction: "Ghi nhận tiến hóa hpDT" },
  ];

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Giám sát AI</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Thống kê lớp học & Dự báo</p>
        </div>
        <button className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-primary">
          <Bell size={24} />
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-6">
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-8 rounded-[40px] border border-gray-100 bg-white space-y-4 shadow-soft hover:shadow-premium transition-all ${idx === 0 ? 'col-span-2' : ''}`}
          >
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-4xl font-black text-gray-900 tracking-tighter">{stat.value}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 italic">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Predictive AI Alerts */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-primary" />
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">AI Dự báo Trạng thái (Next-State)</h3>
        </div>

        <div className="space-y-6">
          {predictions.map((pred, idx) => (
            <motion.div 
              key={idx}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className={`bg-white border-2 p-8 rounded-[40px] shadow-soft flex flex-col gap-6 relative overflow-hidden ${pred.alert ? 'border-red-100' : 'border-gray-50'}`}
            >
              {pred.alert && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 -rotate-12 translate-x-8 -translate-y-8 flex items-center justify-center">
                  <AlertCircle size={60} className="text-red-500 opacity-20" />
                </div>
              )}
              
              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-1">
                  <h4 className="text-xl font-black text-gray-900">{pred.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${pred.alert ? 'text-red-500' : 'text-blue-500'}`}>
                      {pred.status}
                    </span>
                    <span className="text-gray-200">•</span>
                    <span className="text-[10px] font-bold text-gray-400">Độ tin cậy AI: {pred.confidence}%</span>
                  </div>
                </div>
                <div className={`p-3 rounded-2xl ${pred.alert ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                  <Target size={24} />
                </div>
              </div>

              <div className={`p-6 rounded-3xl ${pred.alert ? 'bg-red-50/50 text-red-900' : 'bg-primary/5 text-primary'} border border-white`}>
                <p className="text-xs font-black uppercase tracking-[0.15em] mb-2 opacity-60">Gợi ý hành động can thiệp</p>
                <div className="flex justify-between items-center">
                  <p className="text-lg font-extrabold tracking-tight italic">"{pred.nextAction}"</p>
                  <ArrowUpRight size={24} className="opacity-40" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Global hpDT Chart Placeholder */}
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-primary rounded-[40px] p-10 text-white shadow-hpdt flex flex-col items-center justify-center text-center space-y-4"
      >
        <Brain size={48} className="text-white/30" />
        <p className="text-lg font-black tracking-tight leading-relaxed italic">
          "Học sinh Hoàng Anh đang tiệm cận mức hòa nhập 70%. <br className="hidden sm:block" /> AI gợi ý cô chuẩn bị hồ sơ chuyển đổi giáo trình."
        </p>
      </motion.div>
    </div>
  );
}
