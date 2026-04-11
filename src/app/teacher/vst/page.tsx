"use client";

import { useState } from "react";
import { Send, Sparkles, Wand2, Lightbulb, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { askVST } from "@/app/actions/gemini";

export default function VSTAssistant() {
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Chào Thầy/Cô! Tôi là Trợ lý VST. Hôm nay tôi có thể giúp gì cho việc can thiệp của bé Sữa?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input || isTyping) return;
    
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    
    try {
      const response = await askVST(input);
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "Hệ thống đang bận. Bạn hãy thử lại sau nhé." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = [
    "Gợi ý kỹ năng Giao tiếp",
    "Mẹo xử lý khi bé la hét",
    "Phân tích clip vừa tải lên",
    "Kết nối hpDT bé Rô"
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] text-white">
      <header className="p-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="text-primary-light" size={20} /> Trợ lý VST
          </h1>
          <p className="text-xs text-gray-500">Kịch bản can thiệp cá nhân hóa</p>
        </div>
        <div className="bg-primary/20 p-2 rounded-lg">
          <Wand2 size={18} className="text-primary-light" />
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-tr-none' 
                  : 'bg-[#1E293B] text-gray-100 rounded-tl-none border border-white/5'
              }`}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-[#1E293B] p-4 rounded-2xl rounded-tl-none border border-white/5 flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Suggestions and Input */}
      <div className="p-6 space-y-4 bg-[#1E293B]/50 backdrop-blur-md border-t border-white/5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {suggestions.map((s, i) => (
            <button 
              key={i} 
              onClick={() => setInput(s)}
              className="whitespace-nowrap bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full text-xs text-gray-300 flex items-center gap-2 transition-all"
            >
              <Lightbulb size={12} className="text-yellow-500" /> {s}
            </button>
          ))}
        </div>

        <div className="relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Đặt câu hỏi về can thiệp..."
            className="w-full bg-[#0F172A] border border-white/10 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-sm"
          />
          <button 
            onClick={handleSend}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary rounded-xl flex items-center justify-center hover:bg-primary-dark transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
