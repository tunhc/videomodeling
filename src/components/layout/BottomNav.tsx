"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, Brain, MessageSquare, Library, User, 
  Users, ClipboardList, BarChart3, Calendar, Activity
} from "lucide-react";
import { motion } from "framer-motion";

export default function BottomNav({ role }: { role: "parent" | "teacher" }) {
  const pathname = usePathname();
  
  const parentLinks = [
    { href: "/parent", icon: Activity, label: "Tổng quan" },
    { href: "/parent/hpdt", icon: Brain, label: "hpDT" },
    { href: "/parent/vst", icon: MessageSquare, label: "Trợ lý VST", isMain: true },
    { href: "/parent/library", icon: Library, label: "Thư viện" },
    { href: "/parent/profile", icon: User, label: "Hồ sơ" },
  ];

  const teacherLinks = [
    { href: "/teacher", icon: Users, label: "Lớp học" },
    { href: "/teacher/hubvideo", icon: Library, label: "Thư viện" },
    { href: "/teacher/hub", icon: Brain, label: "AI Phân tích", isMain: true },
    { href: "/teacher/instruction", icon: MessageSquare, label: "Lời nhắn" },
    { href: "/teacher/schedule", icon: Calendar, label: "Lịch dạy" },
  ];

  const links = role === "parent" ? parentLinks : teacherLinks;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-gray-100 px-4 sm:px-6 py-4 flex justify-between items-end z-[50] pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
      {links.map((link) => {
        const isActive = pathname === link.href;
        
        if (link.isMain) {
          return (
            <Link key={link.href} href={link.href} className="relative mb-2">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-[20px] sm:rounded-[24px] shadow-hpdt flex items-center justify-center text-white"
              >
                <link.icon size={24} className="sm:size-7" fill="currentColor" />
              </motion.div>
              <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase whitespace-nowrap tracking-wider ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                {link.label}
              </span>
            </Link>
          );
        }

        return (
          <Link key={link.href} href={link.href} className="flex flex-col items-center gap-1.5 group mb-2">
            <div className={`transition-all ${isActive ? 'text-primary' : 'text-gray-300 group-hover:text-gray-600'}`}>
              <link.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-tighter transition-all ${isActive ? 'text-primary' : 'text-gray-300'}`}>
              {link.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
