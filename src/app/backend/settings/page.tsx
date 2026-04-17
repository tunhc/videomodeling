"use client";

import { Settings, ShieldAlert, Bell, Globe, Palette } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Cài đặt hệ thống</h1>
        <p className="text-gray-500 font-medium">Tùy chỉnh cấu hình và các tham số vận hành của AI4Autism.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[
          { name: "Bảo mật & Phân quyền", icon: <ShieldAlert />, desc: "Quản lý các policy truy cập và bảo vệ dữ liệu." },
          { name: "Thông báo", icon: <Bell />, desc: "Cấu hình Email và thông báo đẩy cho Phụ huynh/GV." },
          { name: "Ngôn ngữ & Vùng", icon: <Globe />, desc: "Tùy chỉnh định dạng ngày tháng và ngôn ngữ hiển thị." },
          { name: "Giao diện", icon: <Palette />, desc: "Thay đổi chủ đề màu sắc và logo thương hiệu." },
        ].map((item, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
             <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:rotate-6 mb-6">
                {item.icon}
             </div>
             <h3 className="text-lg font-black text-gray-800 mb-2">{item.name}</h3>
             <p className="text-sm font-medium text-gray-400 leading-relaxed mb-6">{item.desc}</p>
             <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">Coming Soon</span>
                <span className="text-gray-200">
                   <Settings className="w-5 h-5" />
                </span>
             </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-slate-800 p-12 rounded-[3rem] text-center relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
         <div className="relative z-10">
            <h2 className="text-2xl font-black text-white mb-4">Bạn có ý tưởng gì cho mục Cài đặt?</h2>
            <p className="text-slate-400 font-medium max-w-lg mx-auto mb-8">Chúng tôi đang phát triển các tính năng mở rộng để giúp bạn cá nhân hóa hệ thống tốt hơn.</p>
            <button className="px-8 py-3 bg-white text-gray-900 rounded-2xl font-black uppercase text-sm shadow-xl hover:scale-105 transition-all">Gửi phản hồi cho chúng tôi</button>
         </div>
      </div>
    </div>
  );
}
