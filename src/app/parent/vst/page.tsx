"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, User, MessageSquare, Bot, 
  ChevronLeft, MoreVertical, Plus, 
  Image as ImageIcon, Mic, Sparkles,
  Target, Brain, Activity, Loader2,
  Clock
} from "lucide-react";
import Link from "next/link";
import { askVST } from "@/app/actions/gemini";

interface Message {
  id: string;
  text: string;
  sender: "user" | "vst";
  isAI?: boolean;
  timestamp: Date;
}

export default function ParentVSTChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Chào Anh/Chị! Tôi là Cô Dương, trợ lý VST của bé Minh Khôi. Hôm nay bé đã có những tiến bộ rất tuyệt vời về khả năng giao tiếp mắt trong giờ học.",
      sender: "vst",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTeacherOnline, setIsTeacherOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: "user",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInput("");
    setIsTyping(true);

    try {
      if (isTeacherOnline) {
        // Simulate Teacher Response
        setTimeout(() => {
          const resp: Message = {
            id: (Date.now() + 1).toString(),
            text: "Dạ, tôi đã ghi nhận thắc mắc của mình. Dựa trên phân tích AI mới nhất, chỉ số Xã hội của bé đã tăng 5% nhờ bài tập Video Modeling sáng nay ạ. Anh/Chị có muốn xem chi tiết biểu đồ không?",
            sender: "vst",
            timestamp: new Date()
          };
          setMessages(prev => [...prev, resp]);
          setIsTyping(false);
        }, 2000);
      } else {
        // Real AI Auto-Reply
        const aiResponse = await askVST(textToSend, { 
          childName: "Minh Khôi", 
          hpdtOverall: "78%",
          recentActivity: "Video Modeling Giao tiếp mắt" 
        });
        
        const resp: Message = {
          id: (Date.now() + 1).toString(),
          text: aiResponse,
          sender: "vst",
          isAI: true,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, resp]);
        setIsTyping(false);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto relative overflow-hidden">
      {/* Chat Header */}
      <header className="bg-white border-b border-gray-100 p-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/parent" className="p-2 hover:bg-gray-100 rounded-xl transition-all">
            <ChevronLeft size={20} className="text-gray-400" />
          </Link>
          <div className="relative">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black shadow-lg overflow-hidden">
               {isTeacherOnline ? "CD" : <Bot size={24} />}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${isTeacherOnline ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
          </div>
          <button 
            onClick={() => setIsTeacherOnline(!isTeacherOnline)}
            className="text-left group"
          >
            <h1 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2 group-hover:text-primary transition-colors">
              {isTeacherOnline ? "Cô Dương (GD)" : "AI Auto-Reply"}
              <Clock size={12} className="text-gray-300" />
            </h1>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isTeacherOnline ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isTeacherOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isTeacherOnline ? 'Đang trực tuyến' : 'AI Trợ giúp 24/7'}
              </span>
            </div>
          </button>
        </div>
        <button className="p-2 text-gray-400">
          <MoreVertical size={20} />
        </button>
      </header>

      {/* Insight Bar */}
      <div className="bg-primary/5 px-6 py-3 border-b border-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">
            {isTeacherOnline ? "Gợi ý: Hỏi cô về bài tập sáng nay" : "AI đang kết nối với kỹ năng Can thiệp"}
          </span>
        </div>
        <ChevronLeft size={14} className="text-primary rotate-180" />
      </div>

      {/* Message Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth pb-32 no-scrollbar"
      >
        <AnimatePresence>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-bold tracking-tight shadow-sm relative ${
                m.sender === "user" 
                  ? "bg-primary text-white rounded-tr-none shadow-primary/20" 
                  : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
              }`}>
                {m.sender === "vst" && m.isAI && (
                  <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-[#58A6FF] mb-1">
                    <Sparkles size={10} /> AI Specialist
                  </div>
                )}
                {m.text}
                <div className={`text-[8px] mt-2 opacity-50 font-black uppercase tracking-widest ${
                  m.sender === "user" ? "text-white/70" : "text-gray-400"
                }`}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-gray-100 flex gap-1 items-center">
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <footer className="absolute bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 p-6 pb-12">
        <div className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-[28px] p-2 pl-6">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isTeacherOnline ? "Nhắn cho Cô Dương..." : "Hỏi AI về can thiệp..."}
            className="flex-1 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none"
          />
          <div className="flex items-center gap-1">
            <button className="p-3 text-gray-400 hover:text-primary transition-colors">
              <Mic size={20} />
            </button>
            <button 
              onClick={() => handleSend()}
              className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
          {[
            { label: "Báo cáo hôm nay", icon: Activity },
            { label: "Kết quả Video", icon: Target },
            { label: "Tư vấn kỹ năng", icon: Brain }
          ].map((action, i) => (
            <button 
              key={i} 
              onClick={() => handleSend(action.label)}
              className="flex items-center gap-2 whitespace-nowrap bg-white border border-gray-100 px-5 py-3 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95"
            >
              <action.icon size={12} className="text-primary" />
              {action.label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

