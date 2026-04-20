"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface HPDTChartProps {
  childId: string;
}

interface TrendPoint {
  date: string;
  overall: number;
  social: number;
  cognitive: number;
  behavior: number;
}

export default function HPDTChart({ childId }: HPDTChartProps) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) return;

    fetch(`/api/child-analysis-log?childId=${encodeURIComponent(childId)}`)
      .then((r) => r.json())
      .then(({ hpdtTrend }) => {
        setData(
          (hpdtTrend ?? []).filter((p: any) => p.overall > 0)
        );
      })
      .catch((e) => console.error("Failed to fetch HPDT trend:", e))
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) {
    return (
      <div className="bg-white rounded-[28px] p-6 border border-gray-100 shadow-sm flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (data.length < 2) {
    return null; // Don't show chart if not enough data points
  }

  return (
    <div className="bg-white rounded-[28px] p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
          <TrendingUp size={20} />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900 tracking-tight">Biểu đồ cải thiện HPDT</h3>
          <p className="text-xs font-bold text-gray-400">Tính theo ngày upload video</p>
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: "bold" }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: "bold" }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
              itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
              labelStyle={{ fontSize: "12px", color: "#64748b", marginBottom: "4px", fontWeight: "bold" }}
            />
            <Legend wrapperStyle={{ fontSize: "10px", fontWeight: "bold", paddingTop: "10px" }} />
            <Line type="monotone" name="Tổng thể" dataKey="overall" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            <Line type="monotone" name="Xã hội"  dataKey="social"   stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" name="Nhận thức" dataKey="cognitive" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            <Line type="monotone" name="Hành vi" dataKey="behavior" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
