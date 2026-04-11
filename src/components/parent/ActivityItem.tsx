"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Activity, ChevronRight } from "lucide-react";

interface ActivityItemProps {
  title: string;
  location: string;
  duration: string;
  isCompleted: boolean;
}

export default function ActivityItem({ title, location, duration, isCompleted }: ActivityItemProps) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="flex items-center gap-5 bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 group transition-all"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
        isCompleted ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'
      }`}>
        {isCompleted ? <CheckCircle2 size={28} /> : <Activity size={28} className="animate-pulse" />}
      </div>
      
      <div className="flex-1 space-y-0.5">
        <h4 className={`text-base font-extrabold ${isCompleted ? 'text-gray-300 line-through' : 'text-gray-900'}`}>
          {title}
        </h4>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
          {location} • {duration}
        </p>
      </div>

      <ChevronRight size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
    </motion.div>
  );
}
