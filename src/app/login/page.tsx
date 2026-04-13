"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Lock, User, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [center, setCenter] = useState("Kim Bình Center");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Simulate login logic (real logic would query the seeded 'users' collection)
    // For this mockup, we'll check the role based on ID prefix or a dummy lookup
    setTimeout(() => {
      if (!username || !password) {
        setError("Vui lòng nhập đầy đủ thông tin");
        setLoading(false);
        return;
      }

      const isAdmin = username === "PH_admin" || username === "GV_admin";
      
      if (isAdmin) {
        if (password !== "admin$$$") {
          setError("Mật khẩu admin không chính xác");
          setLoading(false);
          return;
        }
        const role = "admin";
        localStorage.setItem("userRole", role);
        localStorage.setItem("userId", username);
        router.push(username.startsWith("PH_") ? "/parent" : "/teacher");
      } else if (username.startsWith("PH_") && username.length > 3) {
        // Mock Parent Login for valid IDs
        localStorage.setItem("userRole", "parent");
        localStorage.setItem("userId", username);
        router.push("/parent");
      } else if (username.startsWith("GV_") && username.length > 3) {
        // Mock Teacher Login for valid IDs
        localStorage.setItem("userRole", "teacher");
        localStorage.setItem("userId", username);
        router.push("/teacher");
      } else {
        setError("ID hoặc Mật khẩu không đúng");
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-calm-gray flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_#E8EAF6_0%,_transparent_40%),_radial-gradient(circle_at_bottom_left,_#E0F2F1_0%,_transparent_40%)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-soft p-8 border border-white/50 backdrop-blur-sm"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary mb-4">
            <Building2 size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">AI4Autism</h1>
          <p className="text-gray-500 mt-2">Video Modeling System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Center Selection */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-800 ml-1">Trung tâm</label>
            <div className="relative">
              <select 
                value={center}
                onChange={(e) => setCenter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option>Kim Bình Center</option>
                <option>Hà Nội Branch</option>
                <option>HCM Branch</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronDown size={20} />
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-800 ml-1">ID người dùng</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <User size={18} />
              </div>
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ví dụ: PH_Long_B01"
                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-800 ml-1">Mật khẩu</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">{error}</p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full primary-btn mt-4 group relative overflow-hidden"
          >
            <span className={loading ? "opacity-0" : "flex items-center justify-center"}>
              Đăng nhập
            </span>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-gray-400 uppercase tracking-widest">
          Empathic Infrastructure
        </div>
      </motion.div>
    </div>
  );
}
