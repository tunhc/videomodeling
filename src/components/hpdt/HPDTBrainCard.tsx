"use client";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";

interface HPDTBrainCardProps {
  value: number;
  status: string;
  emotion: string;
  lastUpdate: string;
}

export default function HPDTBrainCard({ value, status, emotion, lastUpdate }: HPDTBrainCardProps) {
  return (
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative w-full bg-brain-gradient rounded-[40px] p-10 text-white shadow-hpdt overflow-hidden"
    >
      {/* Subtle Outlined Brain Icon on Right */}
      <div className="absolute right-[-20px] top-6 w-48 h-48 opacity-20 pointer-events-none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.04-2.44 2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 2.04-2.44A2.5 2.5 0 0 1 9.5 2Z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.04-2.44 2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 0-2.04-2.44A2.5 2.5 0 0 0 14.5 2Z"/>
        </svg>
      </div>

      <div className="relative z-10 space-y-8">
        {/* Status Capsule */}
        <div className="flex">
          <span className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase border border-white/10">
            hpDT {status}
          </span>
        </div>

        {/* Main Score Area */}
        <div className="space-y-1">
          <h2 className="text-6xl font-black tracking-tighter">{value}%</h2>
          <p className="text-sm font-medium opacity-70 tracking-tight">Chỉ số hòa nhập mục tiêu</p>
        </div>

        {/* Bottom Metadata & Progress Bar */}
        <div className="space-y-4">
          <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-widest opacity-80">
            <span>Cảm xúc: {emotion}</span>
            <span>Cập nhật: {lastUpdate}</span>
          </div>
          
          <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${value}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
