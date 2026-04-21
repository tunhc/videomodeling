"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Video, User, Users, Filter, ChevronLeft, ArrowDown, ArrowUp, Search } from "lucide-react";
import Link from "next/link";

interface VideoSummary {
  childId: string;
  childName: string;
  centerId: string;
  total: number;
  parentCount: number;
  teachers: { id: string; name: string; count: number }[];
}

type SortKey = "childName" | "total" | "parentCount" | "teacher1" | "teacher2";

export default function VideoSummaryPage() {
  const [data, setData] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [centerFilter, setCenterFilter] = useState("KBC");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [columnFilters, setColumnFilters] = useState({
    child: "",
    totalMin: "",
    parentMin: "",
    teacher1: "",
    teacher2: "",
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "childName" ? "asc" : "desc");
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowDown className="w-3 h-3 text-gray-300" />;
    return sortDirection === "asc"
      ? <ArrowUp className="w-3 h-3 text-blue-500" />
      : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // 1. Fetch all required collections
        const [videoSnap, childrenSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "video_modeling")),
          getDocs(collection(db, "children")),
          getDocs(collection(db, "users"))
        ]);

        const childMap: Record<string, { name: string; centerId: string }> = {};
        childrenSnap.forEach(doc => {
          childMap[doc.id] = {
            name: doc.data().name || "Trẻ không tên",
            centerId: doc.data().centerId || doc.id.split('-')[0] || "Unknown"
          };
        });

        const userNames: Record<string, string> = {};
        usersSnap.forEach(doc => {
          userNames[doc.id] = doc.data().name || doc.id;
        });

        // 2. Process video data
        const summaryMap: Record<string, { total: number; parent: number; teachers: Record<string, number> }> = {};

        videoSnap.forEach(doc => {
          const v = doc.data();
          const cid = v.childid || v.childId;
          if (!cid) return;

          // Date Filter logic (on all data fetch for simplicity, or refetch on change if volume is huge)
          const createdAt = v.createdAt?.toDate?.() || new Date(v.createdAt);
          if (startDate && createdAt < new Date(startDate)) return;
          if (endDate) {
             const end = new Date(endDate);
             end.setHours(23,59,59,999);
             if (createdAt > end) return;
          }

          if (!summaryMap[cid]) {
            summaryMap[cid] = { total: 0, parent: 0, teachers: {} };
          }

          summaryMap[cid].total++;
          if (v.role === 'parent') {
            summaryMap[cid].parent++;
          } else if (v.role === 'teacher') {
            const tid = v.teacherId || v.uid || "Unknown Teacher";
            summaryMap[cid].teachers[tid] = (summaryMap[cid].teachers[tid] || 0) + 1;
          }
        });

        // 3. Convert to array and resolve names
        const finalData: VideoSummary[] = Object.entries(summaryMap).map(([cid, stats]) => {
          const sortedTeachers = Object.entries(stats.teachers)
            .map(([id, count]) => ({
              id,
              name: userNames[id] || id,
              count
            }))
            .sort((a, b) => b.count - a.count);

          return {
            childId: cid,
            childName: childMap[cid]?.name || cid,
            centerId: childMap[cid]?.centerId || "Unknown",
            total: stats.total,
            parentCount: stats.parent,
            teachers: sortedTeachers
          };
        });

        setData(finalData);
      } catch (error) {
        console.error("Error fetching video summary:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [startDate, endDate]); // Refetch on date change for accuracy if many records

  const filteredData = useMemo(() => {
    const minTotal = columnFilters.totalMin ? Number(columnFilters.totalMin) : null;
    const minParent = columnFilters.parentMin ? Number(columnFilters.parentMin) : null;

    const filtered = data.filter(item => {
      const matchCenter = item.centerId.toLowerCase().includes(centerFilter.toLowerCase()) || 
                          item.childId.toLowerCase().startsWith(centerFilter.toLowerCase());
      const matchSearch = item.childName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.childId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchChildColumn =
        columnFilters.child.trim() === "" ||
        `${item.childName} ${item.childId}`.toLowerCase().includes(columnFilters.child.toLowerCase());

      const matchTotal = minTotal === null || Number.isNaN(minTotal) ? true : item.total >= minTotal;
      const matchParent = minParent === null || Number.isNaN(minParent) ? true : item.parentCount >= minParent;

      const teacher1Name = item.teachers[0]?.name?.toLowerCase() || "";
      const teacher2Name = item.teachers[1]?.name?.toLowerCase() || "";
      const matchTeacher1 = columnFilters.teacher1.trim() === "" || teacher1Name.includes(columnFilters.teacher1.toLowerCase());
      const matchTeacher2 = columnFilters.teacher2.trim() === "" || teacher2Name.includes(columnFilters.teacher2.toLowerCase());

      return matchCenter && matchSearch && matchChildColumn && matchTotal && matchParent && matchTeacher1 && matchTeacher2;
    });

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "childName") {
        return a.childName.localeCompare(b.childName) * dir;
      }
      if (sortKey === "total") {
        return (a.total - b.total) * dir;
      }
      if (sortKey === "parentCount") {
        return (a.parentCount - b.parentCount) * dir;
      }
      if (sortKey === "teacher1") {
        const aCount = a.teachers[0]?.count || 0;
        const bCount = b.teachers[0]?.count || 0;
        return (aCount - bCount) * dir;
      }
      const aCount = a.teachers[1]?.count || 0;
      const bCount = b.teachers[1]?.count || 0;
      return (aCount - bCount) * dir;
    });

    return sorted;
  }, [data, centerFilter, searchQuery, columnFilters, sortKey, sortDirection]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/backend" className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Video className="w-6 h-6 text-blue-600" />
              Thống kê Video Modeling
            </h1>
            <p className="text-sm text-gray-500 font-medium">Chi tiết số lượng video tải lên theo từng trẻ.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Center Filter */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Filter className="w-4 h-4" />
            </div>
            <input 
              type="text" 
              placeholder="Trung tâm (KBC...)" 
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm w-48"
            />
          </div>

          {/* Date Picker */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[11px] font-bold border-none p-0 focus:ring-0 bg-transparent" />
            <span className="mx-2 text-gray-300 font-bold">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[11px] font-bold border-none p-0 focus:ring-0 bg-transparent" />
          </div>
        </div>
      </div>

      {/* Stats Cards Row (Optional) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <Users className="w-8 h-8 opacity-20 absolute top-6 right-6" />
            <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">Tổng số trẻ</p>
            <h3 className="text-3xl font-black">{filteredData.length}</h3>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
               <Video className="w-6 h-6" />
            </div>
            <div>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tổng video (theo lọc)</p>
               <h3 className="text-2xl font-black text-gray-800">
                  {filteredData.reduce((acc, curr) => acc + curr.total, 0).toLocaleString()}
               </h3>
            </div>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] font-black text-gray-400 uppercase">Tìm kiếm nhanh</span>
              </div>
              <input 
                type="text" 
                placeholder="Tên bé hoặc mã số..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-gray-800 font-bold placeholder:text-gray-300"
              />
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 w-0 group-focus-within:w-full" />
         </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 border-b border-gray-100">
                  <button onClick={() => handleSort("childName")} className="inline-flex items-center gap-1 text-[11px] font-black text-gray-500 uppercase tracking-widest">
                    Bé
                    {renderSortIcon("childName")}
                  </button>
                </th>
                <th className="px-6 py-4 border-b border-gray-100 text-center">
                  <button onClick={() => handleSort("total")} className="inline-flex items-center gap-1 text-[11px] font-black text-gray-500 uppercase tracking-widest">
                    Tổng video
                    {renderSortIcon("total")}
                  </button>
                </th>
                <th className="px-6 py-4 border-b border-gray-100 text-center">
                  <button onClick={() => handleSort("parentCount")} className="inline-flex items-center gap-1 text-[11px] font-black text-gray-500 uppercase tracking-widest">
                    PH Upload
                    {renderSortIcon("parentCount")}
                  </button>
                </th>
                <th className="px-6 py-4 border-b border-gray-100">
                  <button onClick={() => handleSort("teacher1")} className="inline-flex items-center gap-1 text-[11px] font-black text-gray-500 uppercase tracking-widest">
                    Giáo viên 1
                    {renderSortIcon("teacher1")}
                  </button>
                </th>
                <th className="px-6 py-4 border-b border-gray-100">
                  <button onClick={() => handleSort("teacher2")} className="inline-flex items-center gap-1 text-[11px] font-black text-gray-500 uppercase tracking-widest">
                    Giáo viên 2
                    {renderSortIcon("teacher2")}
                  </button>
                </th>
              </tr>
              <tr className="bg-white">
                <th className="px-6 py-3 border-b border-gray-100">
                  <input
                    value={columnFilters.child}
                    onChange={(e) => setColumnFilters((prev) => ({ ...prev, child: e.target.value }))}
                    placeholder="Lọc theo bé"
                    className="w-full h-8 rounded-lg border border-gray-200 px-2 text-[11px] font-bold text-gray-700"
                  />
                </th>
                <th className="px-6 py-3 border-b border-gray-100">
                  <input
                    type="number"
                    min={0}
                    value={columnFilters.totalMin}
                    onChange={(e) => setColumnFilters((prev) => ({ ...prev, totalMin: e.target.value }))}
                    placeholder="Min"
                    className="w-full h-8 rounded-lg border border-gray-200 px-2 text-[11px] font-bold text-gray-700 text-center"
                  />
                </th>
                <th className="px-6 py-3 border-b border-gray-100">
                  <input
                    type="number"
                    min={0}
                    value={columnFilters.parentMin}
                    onChange={(e) => setColumnFilters((prev) => ({ ...prev, parentMin: e.target.value }))}
                    placeholder="Min"
                    className="w-full h-8 rounded-lg border border-gray-200 px-2 text-[11px] font-bold text-gray-700 text-center"
                  />
                </th>
                <th className="px-6 py-3 border-b border-gray-100">
                  <input
                    value={columnFilters.teacher1}
                    onChange={(e) => setColumnFilters((prev) => ({ ...prev, teacher1: e.target.value }))}
                    placeholder="Lọc GV1"
                    className="w-full h-8 rounded-lg border border-gray-200 px-2 text-[11px] font-bold text-gray-700"
                  />
                </th>
                <th className="px-6 py-3 border-b border-gray-100">
                  <input
                    value={columnFilters.teacher2}
                    onChange={(e) => setColumnFilters((prev) => ({ ...prev, teacher2: e.target.value }))}
                    placeholder="Lọc GV2"
                    className="w-full h-8 rounded-lg border border-gray-200 px-2 text-[11px] font-bold text-gray-700"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-6"><div className="h-4 bg-gray-100 rounded w-48" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-gray-100 rounded w-16 mx-auto" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-gray-100 rounded w-16 mx-auto" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                  </tr>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr key={item.childId} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-800 group-hover:text-blue-600 transition-colors">{item.childName}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{item.childId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-black text-sm">
                        {item.total}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="text-sm font-bold text-indigo-600">{item.parentCount} vids</span>
                    </td>
                    <td className="px-6 py-6">
                      {item.teachers[0] ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-700">{item.teachers[0].name}</span>
                            <span className="text-[10px] font-black text-emerald-600 uppercase">{item.teachers[0].count} videos</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic font-medium">Chưa có dữ liệu</span>
                      )}
                    </td>
                    <td className="px-6 py-6">
                      {item.teachers[1] ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-700">{item.teachers[1].name}</span>
                            <span className="text-[10px] font-black text-orange-600 uppercase">{item.teachers[1].count} videos</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic font-medium">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 font-medium">
                    Không tìm thấy dữ liệu video cho trung tâm hoặc khoảng ngày đã chọn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
