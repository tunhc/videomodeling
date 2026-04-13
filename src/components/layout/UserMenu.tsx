"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, Settings, ChevronDown } from "lucide-react";

interface UserMenuProps {
  userName: string;
  role: string;
  avatarInitial?: string;
}

export default function UserMenu({ userName, role, avatarInitial }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  const roleLabel = role === "admin" ? "Quản trị viên" : role === "teacher" ? "Giáo viên" : "Phụ huynh";

  return (
    <div className="relative">
      {/* Trigger */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 pr-4 rounded-3xl bg-white/40 hover:bg-white/60 backdrop-blur-md border border-white/50 transition-all shadow-sm"
      >
        <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black shadow-hpdt">
          {avatarInitial || userName[0]?.toUpperCase() || "U"}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-[13px] font-black text-gray-900 leading-tight">
            {userName.split(' ')[0]}
          </p>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            {roleLabel}
          </p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for closing */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 sm:right-auto sm:left-0 mt-4 w-64 bg-white border border-gray-100 shadow-2xl rounded-[32px] overflow-hidden z-[100] p-2 origin-top-right sm:origin-top-left"
            >
              <div className="px-6 py-4 border-b border-gray-100/50 mb-2">
                <p className="text-sm font-black text-gray-900">{userName}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{roleLabel}</p>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-6 py-4 text-sm font-bold text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors group rounded-2xl"
                >
                  <div className="p-2 rounded-xl bg-gray-50 group-hover:bg-primary/10 transition-colors text-gray-400 group-hover:text-primary">
                    <User size={18} />
                  </div>
                  Thông tin cá nhân
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-6 py-4 text-sm font-bold text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors group rounded-2xl"
                >
                  <div className="p-2 rounded-xl bg-gray-50 group-hover:bg-primary/10 transition-colors text-gray-400 group-hover:text-primary">
                    <Settings size={18} />
                  </div>
                  Cài đặt
                </button>
                <div className="h-px bg-gray-100/50 mx-4 my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-6 py-4 text-sm font-black text-red-500 hover:bg-red-50 transition-colors group rounded-2xl"
                >
                  <div className="p-2 rounded-xl bg-red-50 text-red-500">
                    <LogOut size={18} />
                  </div>
                  Đăng xuất
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
