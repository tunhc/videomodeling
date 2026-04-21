"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Activity, Users, Video, FileText, ArrowUpRight, CheckCircle2, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VideoMetadata } from "@/types/database";
import { checkVideoQuality } from "@/lib/video-quality";

type TimeFrame = 'day' | 'week' | 'month';

interface LeaderboardItem {
  id: string;
  name: string;
  videoCount: number;
}

function parseVideoDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate?: () => Date }).toDate?.();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function BackendDashboardPage() {
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [childNameMap, setChildNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [expertsCount, setExpertsCount] = useState(0);
  const [reportsCount, setReportsCount] = useState(0);

  // Filtering states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterChildId, setFilterChildId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const videoQuery = query(collection(db, "video_modeling"));
        const videoSnap = await getDocs(videoQuery);
        
        const videoData: VideoMetadata[] = [];
        videoSnap.forEach((doc) => {
          const data = doc.data();
          videoData.push({ id: doc.id, ...data } as VideoMetadata);
        });
        setVideos(videoData);

        const usersSnap = await getDocs(collection(db, "users"));
        let accounts = 0;
        let experts = 0;
        usersSnap.forEach((doc) => {
          const id = doc.id;
          if (id.startsWith("CG_")) experts++;
          else if ((id.startsWith("PH_") || id.startsWith("GV_")) && !["PH_admin", "GV_admin"].includes(id)) accounts++;
        });
        setTotalAccounts(accounts);
        setExpertsCount(experts);

        const reportsSnap = await getDocs(collection(db, "lessons"));
        setReportsCount(reportsSnap.size);

        const childrenSnap = await getDocs(collection(db, "children"));
        const childNames: Record<string, string> = {};
        childrenSnap.forEach((doc) => {
          childNames[doc.id] = doc.data().name || "Trẻ không tên";
        });
        setChildNameMap(childNames);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const effectiveRange = useMemo(() => {
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      return {
        start,
        end,
        startInput: toInputDate(start),
        endInput: toInputDate(end),
      };
    }

    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start = new Date(now);
    if (timeFrame === "day") {
      start.setDate(now.getDate() - 13);
      start.setHours(0, 0, 0, 0);
    } else if (timeFrame === "week") {
      const startOfCurrentWeek = getStartOfWeek(now);
      start = new Date(startOfCurrentWeek);
      start.setDate(start.getDate() - 7 * 11);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
    }

    return {
      start,
      end,
      startInput: toInputDate(start),
      endInput: toInputDate(end),
    };
  }, [startDate, endDate, timeFrame]);

  const rangeFilteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const created = parseVideoDate(video.createdAt);
      if (!created) return false;
      if (created < effectiveRange.start || created > effectiveRange.end) return false;
      if (filterChildId && video.childId !== filterChildId) return false;
      return true;
    });
  }, [videos, effectiveRange, filterChildId]);

  const chartData = useMemo(() => {
    if (!rangeFilteredVideos.length) return [];

    const grouped = new Map<string, { parent: number, teacher: number, name: string }>();
    rangeFilteredVideos.forEach(v => {
      const createdDate = parseVideoDate(v.createdAt);
      if (!createdDate) return;
      const d = new Date(createdDate);

      let key = "", name = "";
      if (timeFrame === 'day') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        name = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (timeFrame === 'week') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(d.setDate(diff));
        startOfWeek.setHours(0,0,0,0);
        key = `W-${startOfWeek.getTime()}`;
        name = `${String(startOfWeek.getDate()).padStart(2, '0')}/${String(startOfWeek.getMonth() + 1).padStart(2, '0')}`;
      } else if (timeFrame === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        name = `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
      }

      if (!grouped.has(key)) grouped.set(key, { parent: 0, teacher: 0, name });
      const current = grouped.get(key)!;
      if (v.role === 'parent') current.parent += 1;
      else if (v.role === 'teacher') current.teacher += 1;
    });

    const sortedData = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(entry => entry[1]);

    return sortedData;
  }, [rangeFilteredVideos, timeFrame]);

  const leaderboard = useMemo<LeaderboardItem[]>(() => {
    const childVideoCounts: Record<string, number> = {};
    rangeFilteredVideos.forEach((video) => {
      if (!video.childId) return;
      childVideoCounts[video.childId] = (childVideoCounts[video.childId] || 0) + 1;
    });

    return Object.entries(childVideoCounts)
      .map(([childId, count]) => ({
        id: childId,
        name: childNameMap[childId] || childId,
        videoCount: count,
      }))
      .sort((a, b) => b.videoCount - a.videoCount)
      .slice(0, 5);
  }, [rangeFilteredVideos, childNameMap]);

  const teacherQualityMetric = useMemo(() => {
    const teacherVideos = rangeFilteredVideos.filter((video) => video.role === "teacher");
    if (teacherVideos.length === 0) {
      return { qualified: 0, total: 0, rate: 0 };
    }

    const qualified = teacherVideos.filter((video) => checkVideoQuality(video).eligible).length;
    return {
      qualified,
      total: teacherVideos.length,
      rate: Math.round((qualified / teacherVideos.length) * 100),
    };
  }, [rangeFilteredVideos]);

  const stats = [
    { label: "Tổng số video", value: videos.length.toLocaleString(), icon: <Video className="w-6 h-6" />, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Tổng số tài khoản", value: totalAccounts.toLocaleString(), icon: <Users className="w-6 h-6" />, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Chuyên gia/GV", value: expertsCount.toLocaleString(), icon: <CheckCircle2 className="w-6 h-6" />, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Báo cáo phân tích", value: reportsCount.toLocaleString(), icon: <FileText className="w-6 h-6" />, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
    {
      label: "GV upload đạt chuẩn",
      value: `${teacherQualityMetric.rate}%`,
      subValue: `${teacherQualityMetric.qualified}/${teacherQualityMetric.total} video`,
      icon: <Activity className="w-6 h-6" />,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  const rangeText = `${effectiveRange.startInput} → ${effectiveRange.endInput}`;

  return (
    <div className="space-y-8 p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Tổng quan hệ thống</h1>
          <p className="text-gray-500 font-medium">Theo dõi các chỉ số quan trọng và trạng thái hoạt động của AI4Autism.</p>
        </div>
        <button className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 shadow-sm hover:bg-gray-50">Xuất báo cáo</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
        {stats.map((stat, i) => {
          const cardContent = (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group h-full cursor-pointer">
              <div className="flex items-center justify-between mb-6">
                <div className={`w-14 h-14 rounded-2xl ${stat.bg || ''} flex items-center justify-center text-current group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                  <div className={stat.color || ''}>
                    {stat.icon}
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-bold flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  +12%
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                <h3 className="text-3xl font-black text-gray-800">
                  {loading && i === 0 ? "..." : stat.value}
                </h3>
                {("subValue" in stat) && stat.subValue ? (
                  <p className="text-xs font-semibold text-gray-500 mt-1">{stat.subValue}</p>
                ) : null}
              </div>
            </div>
          );

          if (i === 0) {
            return (
              <Link href="/backend/videos" key={i}>
                {cardContent}
              </Link>
            );
          }

          return <div key={i}>{cardContent}</div>;
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-500" />
                Lưu lượng Video Tải lên
                {filterChildId && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full border border-blue-200 uppercase font-black tracking-tight">
                    Bé: {leaderboard.find(b => b.id === filterChildId)?.name}
                  </span>
                )}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] font-bold border-none p-0 focus:ring-0" />
                <span className="text-gray-300">|</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[10px] font-bold border-none p-0 focus:ring-0" />
              </div>
              <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                {['day', 'week', 'month'].map(tf => (
                  <button key={tf} onClick={() => setTimeFrame(tf as TimeFrame)} className={`px-3 py-1 text-[10px] font-black rounded-md ${timeFrame === tf ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-800 text-center uppercase'}`}>{tf === 'day' ? 'Ngày' : tf === 'week' ? 'Tuần' : 'Tháng'}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 h-[400px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#999' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#999' }} />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }} />
                  <Bar dataKey="parent" name="PH" stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="teacher" name="GV" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-medium">Không có dữ liệu phù hợp</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Top 5 bé theo phạm vi biểu đồ</h2>
              <p className="text-[11px] font-semibold text-gray-500">Range: {rangeText}</p>
            </div>
            {filterChildId && <button onClick={() => setFilterChildId(null)} className="text-[10px] font-black text-blue-600 border border-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-50">TẤT CẢ BIỂU ĐỒ</button>}
          </div>
          <div className="p-6 space-y-3">
            {leaderboard.length > 0 ? leaderboard.map((item, i) => {
              const params = new URLSearchParams({
                childId: item.id,
                startDate: effectiveRange.startInput,
                endDate: effectiveRange.endInput,
              });
              const href = `/backend/videolist?${params.toString()}`;
              return (
                <div key={item.id} className={`w-full p-4 rounded-2xl transition-all ${filterChildId === item.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setFilterChildId(filterChildId === item.id ? null : item.id)} className="flex items-center gap-3 text-left flex-1">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${filterChildId === item.id ? 'bg-white/20' : 'bg-white text-blue-600 border border-gray-100 shadow-sm'}`}>{i + 1}</span>
                      <div>
                        <p className={`text-sm font-bold truncate max-w-[140px] ${filterChildId === item.id ? 'text-white' : 'text-gray-800'}`}>{item.name}</p>
                        <p className={`text-[10px] uppercase font-black opacity-50 ${filterChildId === item.id ? 'text-white' : 'text-gray-400'}`}>Hồ sơ trẻ</p>
                      </div>
                    </button>
                    <div className="text-right">
                      <span className="text-lg font-black">{item.videoCount}</span>
                      <span className="text-[10px] uppercase font-black ml-1 opacity-60">vids</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <Link href={href} className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide ${filterChildId === item.id ? 'text-white/90 hover:text-white' : 'text-blue-600 hover:text-blue-700'}`}>
                      Xem video trong range
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            }) : (
              <div className="py-12 text-center text-gray-400 font-semibold text-sm">
                Chưa có dữ liệu top 5 trong phạm vi đã chọn.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
