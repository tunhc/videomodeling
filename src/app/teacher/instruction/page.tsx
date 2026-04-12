"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, MessageSquare, Sparkles, CheckCircle2, Bell, Loader2, Users, ChevronRight } from "lucide-react";
import { sendInstruction } from "@/lib/services/taskService";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";

export default function InstructionPage() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [fetching, setFetching] = useState(true);

  const userId = typeof window !== 'undefined' ? localStorage.getItem("userId") || "GV_DUONG_01" : "GV_DUONG_01";
  const [teacherName, setTeacherName] = useState("Giáo viên");

  useEffect(() => {
    async function loadIdentity() {
      const docSnap = await getDoc(doc(db, "users", userId));
      if (docSnap.exists()) {
        setTeacherName(docSnap.data().displayName || "Giáo viên");
      }
    }
    loadIdentity();
  }, [userId]);

  useEffect(() => {
    async function loadChildren() {
      try {
        const q = query(collection(db, "children"), where("teacherId", "==", userId));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setChildren(list);
        if (list.length > 0) setSelectedChild(list[0]);
      } catch (e) {
        console.error("Load children failed:", e);
      } finally {
        setFetching(false);
      }
    }
    loadChildren();
  }, []);

  const handleSend = async () => {
    if (!message.trim() || !selectedChild) return;
    setLoading(true);
    setError("");

    try {
      await sendInstruction({
        teacherId: userId,
        teacherName: teacherName,
        childId: selectedChild.id,
        parentId: selectedChild.parentId || "PH_DEFAULT",
        content: message.trim(),
        type: "instruction",
      });
      setSent(true);
      setMessage("");
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      setError("Gửi thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    `Nhắc bé tập thể dục lúc 10h sáng`,
    `Bé cần luyện tập cất ba lô đúng chỗ`,
    "Cô đã gửi Video Modeling mới, mẹ cho bé xem nhé",
    "Khen ngợi bé vì đã tương tác mắt tốt hôm nay",
  ];

  if (fetching) {
    return (
      <div className="min-h-screen bg-calming-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-calming-bg min-h-screen pb-32">
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-8 px-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gửi lời nhắn</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            Kết nối Phụ huynh • {selectedChild?.name || "Chọn bé"}
          </p>
        </div>
        <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-primary font-black text-sm uppercase shadow-inner">
          {selectedChild?.name?.[0] || "?"}
        </div>
      </header>

      {/* Child Selection Bar */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chọn bé cần gửi tin</h4>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 no-scrollbar">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all whitespace-nowrap ${
                selectedChild?.id === child.id
                  ? "bg-primary text-white border-primary shadow-premium scale-105"
                  : "bg-white text-gray-600 border-gray-100 hover:border-primary/20"
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                selectedChild?.id === child.id ? "bg-white/20" : "bg-gray-50"
              }`}>
                {child.name?.[0]}
              </div>
              <span className="text-sm font-bold">{child.name}</span>
            </button>
          ))}
        </div>
      </section>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-[40px] p-10 shadow-premium border border-gray-50 space-y-8"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary text-white rounded-2xl shadow-hpdt">
            <MessageSquare size={24} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 italic">
            Hướng dẫn can thiệp nhanh
          </h3>
        </div>

        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Bạn muốn nhắn gì cho phụ huynh? Ví dụ: 'Mẹ hãy nhắc bé 10h tập thể dục'..."
            className="w-full bg-gray-50/50 border-2 border-gray-50 focus:border-primary/20 rounded-[32px] p-8 text-lg font-bold tracking-tight outline-none min-h-[200px] resize-none transition-all placeholder:text-gray-300"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || loading || sent}
            className={`absolute bottom-6 right-6 p-4 rounded-2xl shadow-lg transition-all ${
              sent
                ? "bg-emerald-500 text-white"
                : "bg-primary text-white hover:scale-105 disabled:opacity-40"
            }`}
          >
            {loading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : sent ? (
              <CheckCircle2 size={24} />
            ) : (
              <Send size={24} />
            )}
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 px-6 py-3 rounded-2xl font-bold">{error}</p>
        )}

        {sent && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-emerald-600 text-sm bg-emerald-50 px-6 py-3 rounded-2xl font-bold"
          >
            ✅ Đã gửi! Phụ huynh sẽ nhận được thông báo ngay.
          </motion.p>
        )}

        {/* AI Suggestions */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={14} className="text-yellow-400 fill-yellow-400" /> AI Gợi ý nội dung
          </p>
          <div className="flex flex-wrap gap-3">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setMessage(s)}
                className="bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/50 px-5 py-2.5 rounded-full text-xs font-bold text-primary transition-all text-left"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recent sent message (static history indicator) */}
      <section className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Lời nhắn gần đây
        </h4>
        <div className="bg-white border border-gray-50 rounded-[40px] p-8 flex items-center gap-6 shadow-soft">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
            <Bell size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900 truncate">Nhắc Long uống nước sau 1h</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
              Đã gửi • 08:30
            </p>
          </div>
          <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 shrink-0">
            Đã nhận
          </span>
        </div>
      </section>
    </div>
  );
}
