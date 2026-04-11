"use client";

import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

interface HPDTRadarProps {
  data: { skill: string; value: number; fullMark: number }[];
}

export default function HPDTRadar({ data }: HPDTRadarProps) {
  return (
    <div className="w-full h-80 bg-white rounded-4xl p-6 shadow-premium">
      <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span className="w-1 h-3 bg-primary rounded-full"></span> 
        Phân Tích Năng Lực (hpDT Visualization)
      </h3>
      
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#F1F5F9" />
          <PolarAngleAxis 
            dataKey="skill" 
            tick={{ fill: "#64748B", fontSize: 10, fontWeight: 700 }} 
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={false} 
            axisLine={false} 
          />
          <Radar
            name="hpDT của Bé"
            dataKey="value"
            stroke="#6366F1"
            strokeWidth={3}
            fill="#6366F1"
            fillOpacity={0.3}
          />
          {/* Baseline typical child (100%) */}
          <Radar
            name="Chuẩn điển hình"
            dataKey="fullMark"
            stroke="#E2E8F0"
            strokeWidth={1}
            strokeDasharray="5 5"
            fill="transparent"
            fillOpacity={0}
          />
        </RadarChart>
      </ResponsiveContainer>
      
      <div className="mt-4 flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <span className="text-[10px] font-bold text-gray-500 uppercase">Trẻ hiện tại</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-dashed border-gray-300 rounded-full"></div>
          <span className="text-[10px] font-bold text-gray-400 uppercase">Mốc 100% (Điển hình)</span>
        </div>
      </div>
    </div>
  );
}
