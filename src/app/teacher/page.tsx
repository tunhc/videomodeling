"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, QrCode, TrendingUp, Upload, MessageCircle } from "lucide-react";
import VideoUploadModal from "@/components/VideoUploadModal";
import UserMenu from "@/components/layout/UserMenu";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { getLearnersForTeacher } from "@/lib/services/learnerService";

interface Student {
  id: string;
  name: string;
  initial: string;
  status: string;
  hpdt: number;
}

interface School {
  schoolName: string;
  centerCode: string;
  city: string;
}

export default function TeacherHome() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [userName, setUserName] = useState("Giáo viên");
  const [userRole, setUserRole] = useState("teacher");
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem("userId") || "GV_DUONG_01";
    const role = localStorage.getItem("userRole") || "teacher";
    setUserRole(role);

    async function loadData() {
      try {
        const teacherDoc = await getDoc(doc(db, "users", userId));
        if (teacherDoc.exists()) {
          const data = teacherDoc.data();
          setUserName(data.displayName || "Giáo viên");

          // Priority 1: user.schoolId
          // Priority 2: user.centerCode (treat as schoolId if schoolId missing)
          const targetSchoolId = data.schoolId || data.centerCode;
          
          if (targetSchoolId) {
            const schoolDoc = await getDoc(doc(db, "schools", targetSchoolId));
            if (schoolDoc.exists()) {
              setSchool(schoolDoc.data() as School);
            } else {
              // Fallback if school doc doesn't exist but we have a code
              setSchool({ schoolName: "Kim Bình Center", centerCode: targetSchoolId, city: "HCM" });
            }
          }
        }

        const learners = await getLearnersForTeacher(userId, role);
        const list: Student[] = learners.map((learner) => ({
          id: learner.id,
          name: learner.name || "Học sinh không tên",
          initial: learner.initial || (learner.name ? learner.name[0] : "?"),
          status: learner.status || "Bình thường",
          hpdt: typeof learner.hpdt === "number" ? learner.hpdt : 0,
        }));
        setStudents(list);
      } catch (e) {
        console.error("Failed to load teacher data:", e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const averageHpdt = students.length > 0 
    ? students.reduce((acc, s) => acc + s.hpdt, 0) / students.length 
    : 0;
  // Giả lập công thức đo lường hpDT Tăng trưởng = (Trung bình hpDT lớp / mốc baseline 30) * Tỉ lệ nỗ lực
  const growthHpdt = averageHpdt > 0 ? ((averageHpdt / 30) * 8.5).toFixed(1) : "0.0";

  const dotColors = ["bg-indigo-400", "bg-blue-400", "bg-emerald-400", "bg-violet-400"];
  const bgColors = ["bg-indigo-50 text-primary", "bg-blue-50 text-blue-600", "bg-emerald-50 text-emerald-600", "bg-violet-50 text-violet-600"];

  const handleStudentClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsUploadOpen(true);
  };

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      {/* Header */}
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8 border-b border-white/50">
        <UserMenu 
          userName={userName} 
          role={userRole} 
          avatarInitial="AI"
        />
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">
              {school?.centerCode || "KBC"}
            </p>
            <p className="text-[11px] font-black text-gray-900 mt-1">
              {school?.schoolName || "Đang tải..."}
            </p>
          </div>
          <Link
            href="/teacher/instruction"
            className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-400 hover:text-primary transition-all"
            title="Gửi lời nhắn"
          >
            <MessageCircle size={24} />
          </Link>
        </div>
      </header>

      {/* Stats Summary */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border border-gray-100 rounded-[40px] p-8 space-y-6 shadow-premium relative overflow-hidden"
      >
        <div className="absolute top-[-30px] right-[-30px] opacity-[0.03] pointer-events-none">
          <TrendingUp size={200} />
        </div>
        <div className="flex justify-between items-center relative z-10">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {school ? `${school.centerCode} — Thống kê lớp học` : "Thống kê lớp học"}
          </h3>
          <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 italic">
            Tháng này
          </span>
        </div>
        <div className="grid grid-cols-2 gap-8 relative z-10">
          <div className="space-y-1">
            <p className="text-4xl font-black text-gray-900 tracking-tighter">+{growthHpdt}%</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tăng trưởng hpDT</p>
          </div>
          <div className="space-y-1 text-right border-l border-gray-100 pl-8">
            <p className="text-4xl font-black text-emerald-500 tracking-tighter">
              {loading ? "..." : `${students.length}`}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Học sinh</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Search */}
      <div className="relative group">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm tên học sinh..."
          className="w-full bg-white border border-gray-100 focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-[32px] py-6 px-14 text-sm font-bold tracking-tight outline-none shadow-soft transition-all"
        />
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
        <QrCode className="absolute right-6 top-1/2 -translate-y-1/2 text-primary opacity-40" size={20} />
      </div>

      {/* Student Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-300 font-bold">Đang tải học sinh...</div>
      ) : (
        <div className="grid grid-cols-2 gap-6 pb-20">
          {filtered.map((student, idx) => (
            <motion.div
              key={student.id}
              onClick={() => handleStudentClick(student.id)}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-[40px] border border-gray-50 p-8 space-y-6 shadow-soft hover:shadow-premium transition-all group relative overflow-hidden cursor-pointer active:scale-95"
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Upload size={14} />
                </div>
              </div>
              <div
                className={`w-14 h-14 ${bgColors[idx % bgColors.length]} rounded-[24px] flex items-center justify-center text-xl font-black transition-transform group-hover:scale-110 shadow-inner`}
              >
                {student.initial}
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-gray-900 tracking-tight">{student.name}</h4>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 ${dotColors[idx % dotColors.length]} rounded-full`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    {student.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2 relative z-10">
                <div className="flex justify-between text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">
                  <span>Tiến độ hpDT</span>
                  <span>{student.hpdt}%</span>
                </div>
                <div className="w-full bg-gray-50 h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${student.hpdt}%` }}
                    className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <VideoUploadModal role="teacher" isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} childId={selectedStudentId} />
    </div>
  );
}
