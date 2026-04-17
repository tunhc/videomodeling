"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { getAuthSession, clearAuthSession } from "@/lib/auth-session";
import { doc, getDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import Link from "next/link";
import { LayoutDashboard, Users, Settings, LogOut, Menu, X, ShieldAlert, Video, Activity } from "lucide-react";

export default function BackendLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { name: "Tổng quan", href: "/backend", icon: <LayoutDashboard className="w-5 h-5" />, roles: ["admin", "professor", "projectmanager"] },
    { name: "Thống kê Video", href: "/backend/videos", icon: <Video className="w-5 h-5" />, roles: ["admin", "projectmanager", "professor"] },
    { name: "Danh sách Video", href: "/backend/videolist", icon: <Activity className="w-5 h-5" />, roles: ["admin", "professor"] },
    { name: "Người dùng", href: "/backend/users", icon: <Users className="w-5 h-5" />, roles: ["admin"] },
    { name: "Cài đặt", href: "/backend/settings", icon: <Settings className="w-5 h-5" />, roles: ["admin"] },
  ];

  const [activeUserRole, setActiveUserRole] = useState<string>("");

  useEffect(() => {
    // Check screen size for sidebar state
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    
    // Initial check
    handleResize();
    window.addEventListener("resize", handleResize);

    const checkSession = async () => {
      const session = getAuthSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      try {
        const userDocRef = doc(db, "users", session.userId);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          setError("Không tìm thấy thông tin người dùng.");
          setLoading(false);
          return;
        }

        const data = userDocSnap.data();
        const role = (data.role || session.userRole || "").toLowerCase();
        setActiveUserRole(role);

        // Sync with Firebase Auth for Storage permissions
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (syncErr) {
            console.error("Layout Auth Sync error:", syncErr);
          }
        }

        // RBAC Access Guard
        if (!["admin", "professor", "projectmanager"].includes(role)) {
          setError("Không có quyền truy cập");
          setLoading(false);
          return;
        }

        // Specific route protection
        const currentPath = pathname;
        const targetNav = navItems.find(item => item.href === currentPath);
        
        if (targetNav && !targetNav.roles.includes(role)) {
           // If on a sub-page of videos (like summary), PM might have access but others might not
           // For simplicity, if not in roles list, redirect to backend home
           router.replace("/backend");
           return;
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Đã xảy ra lỗi khi xác thực quyền truy cập.");
        setLoading(false);
      }
    };
    
    checkSession();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [router, pathname]);

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-hidden font-lexend">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Menu */}
      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed inset-y-0 left-0 z-50 w-72 bg-[#0f172a] text-slate-300 transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 shadow-2xl flex flex-col border-r border-slate-800/50
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-20 px-6 bg-[#0b1121] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-emerald-400 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              AI4Autism
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Quản lý hệ thống</p>
          {navItems.filter(item => item.roles.includes(activeUserRole)).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 font-semibold" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </div>
                <span>{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-6 bg-blue-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-6 border-t border-slate-800 bg-[#0b1121]">
          <button 
            onClick={() => {
              clearAuthSession();
              router.replace("/login");
            }}
            className="flex items-center gap-3 w-full px-4 py-3.5 text-slate-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all duration-300 group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-200/80 flex items-center justify-between px-6 lg:px-10 z-30 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:block">
              <h2 className="text-xl font-bold text-gray-800">
                {navItems.find(item => item.href === pathname)?.name || "Dashboard"}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-gray-800 leading-none mb-1">
                {activeUserRole === "admin" ? "Quản trị viên" : activeUserRole === "professor" ? "Chuyên gia" : "Quản lý Dự án"}
              </span>
              <span className="text-xs text-gray-500 font-medium leading-none">Hệ thống</span>
            </div>
            <button className="relative group focus:outline-none">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full opacity-0 group-hover:opacity-100 blur transition-opacity duration-300" />
              <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-indigo-50 border-2 border-white shadow-sm flex items-center justify-center text-blue-700 font-black text-lg overflow-hidden">
                 A
              </div>
            </button>
          </div>
        </header>

        {/* Page Content View */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
        }
      `}} />
    </div>
  );
}
