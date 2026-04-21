"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  collection, getDocs, query, orderBy, doc,
  addDoc, serverTimestamp, deleteDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { getAuthSession } from "@/lib/auth-session";
import { checkVideoQuality } from "@/lib/video-quality";
import {
  Search, Calendar, MapPin, User, FileText, Upload,
  ChevronRight, Play, Eye, X, MessageSquare, FileSignature,
  FileCode, Download, Video, Trash2,
  Brain, Activity, Sparkles, ListChecks, Send,
  BookOpen, ChevronDown, ChevronUp, CheckSquare, Square,
  BarChart2, TrendingUp, ShieldCheck, ShieldAlert, FileDown,
  ArrowUpDown,
} from "lucide-react";

// ─── Interfaces ────────────────────────────────────────────────────────────

interface VideoItem {
  id: string;
  url: string;
  childId: string;
  childName: string;
  role: string;
  location: string;
  createdAt: any;
  topic: string;
  status?: string;
  duration?: number;
  primaryTag?: string;
  context?: string;
  category?: string;
  parentNote?: string;
  expertNote?: string;
}

interface InterventionPlan {
  id: string;
  name: string;
  url: string;
  uploadedAt: any;
  uploaderName: string;
}

interface ProfessorNote {
  id: string;
  authorName: string;
  authorId: string;
  content: string;
  createdAt: any;
}

interface Segment {
  segmentId: string;
  startTime: number;
  endTime: number;
  motionLevel: "high" | "medium" | "low";
  motionScore: number;
  behaviorType: string;
  behaviorLabel: string;
  functionalAnalysis: string;
  interventionHint: string;
}

interface ChecklistItem {
  itemId: string;
  description: string;
  category: "prerequisite" | "target" | "generalization";
  masteryTarget: number;
}

interface LessonStep {
  stepId: string;
  order: number;
  title: string;
  description: string;
  duration: number;
  promptLevel: string;
  therapistAction: string;
  childAction: string;
}

interface Lesson {
  lessonId: string;
  title: string;
  lessonType: string;
  vmType: string;
  rationale: string;
  steps: LessonStep[];
  checklist: ChecklistItem[];
  masteryThreshold: number;
  estimatedSessions: number;
  forRole: string;
}

interface FrameHpdt {
  social: number;
  cognitive: number;
  behavior: number;
  sensory: number;
  motor: number;
  overall: number;
}

interface FrameVideoQuality {
  lighting: string;
  sharpness: string;
  frontView: boolean;
  sideView45: boolean;
  overallPass: boolean;
  warnings: string[];
}

interface AnalysisData {
  analysisId: string;
  frameAnalysis: {
    tags: string[];
    summary: string;
    suggestedNote: string;
    hpdt: FrameHpdt;
    videoQuality?: FrameVideoQuality;
  };
  segments: Segment[];
  summary: {
    dominantBehavior: string;
    regulationLevel: "dysregulated" | "transitioning" | "regulated";
    keyInsights: string[];
    overallRecommendation: string;
  };
  interventionPlan: {
    approach: string[];
    goals: { goalId: string; domain: string; targetBehavior: string; smartGoal: string; timeframe: string }[];
    lessons: Lesson[];
    collaborationMessage: string;
  };
  taskId: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const decodeUrl = (str: string) => {
  if (!str) return "";
  if (str.startsWith("http")) return str;
  try { return atob(str); } catch { return str; }
};

/** Generate a Cloudinary thumbnail URL (frame at 1s) for a video URL. */
function getCloudinaryThumb(videoUrl: string): string | null {
  if (!videoUrl?.includes("cloudinary.com")) return null;
  const idx = videoUrl.indexOf("/video/upload/");
  if (idx === -1) return null;
  const base = videoUrl.substring(0, idx);
  const after = videoUrl.substring(idx + "/video/upload/".length);
  const vMatch = after.match(/(v\d{6,}\/.+)/);
  const resource = vMatch ? vMatch[1] : after;
  const jpgPath = resource.replace(/\.[^./?#]+$/, ".jpg");
  return `${base}/video/upload/so_1,w_480,h_270,c_fill/${jpgPath}`;
}

const MOTION_COLOR: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-amber-400",
  low:    "bg-emerald-500",
};
const MOTION_LABEL: Record<string, string> = {
  high: "Cao", medium: "Trung bình", low: "Thấp",
};
const REGULATION_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  dysregulated: { bg: "bg-red-100",    text: "text-red-700",    label: "Mất điều hòa" },
  transitioning:{ bg: "bg-amber-100",  text: "text-amber-700",  label: "Đang chuyển tiếp" },
  regulated:    { bg: "bg-emerald-100",text: "text-emerald-700",label: "Điều hòa tốt" },
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function VideoListPage() {
  const searchParams = useSearchParams();
  const childIdParam = searchParams.get("childId") || "";
  const startDateParam = searchParams.get("startDate") || "";
  const endDateParam = searchParams.get("endDate") || "";
  const locationParam = searchParams.get("location") || "";
  const ageParam = searchParams.get("age") || "";
  const [videos, setVideos]       = useState<VideoItem[]>([]);
  const [children, setChildren]   = useState<Record<string, { name: string; birthday: string }>>({});
  const [loading, setLoading]     = useState(true);

  // Filters
  const [searchChildId, setSearchChildId]   = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [ageFilter, setAgeFilter]           = useState("all");
  const [startDate, setStartDate]           = useState("");
  const [endDate, setEndDate]               = useState("");

  // Child-detail modal
  const [selectedChildId, setSelectedChildId]     = useState<string | null>(null);
  const [selectedChildName, setSelectedChildName] = useState("");
  const [isDetailOpen, setIsDetailOpen]           = useState(false);
  const [loadingDetail, setLoadingDetail]         = useState(false);
  const [plans, setPlans]   = useState<InterventionPlan[]>([]);
  const [notes, setNotes]   = useState<ProfessorNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [uploadProgress, setUploadProgress]   = useState(0);
  const [uploadingPlan, setUploadingPlan]     = useState(false);
  const [previewPlanId, setPreviewPlanId]     = useState<string | null>(null);
  const [previewFileUrl, setPreviewFileUrl]   = useState<string | null>(null);
  const [videoPlayerUrl, setVideoPlayerUrl]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis
  const [analyzingVideoId, setAnalyzingVideoId] = useState<string | null>(null);
  const [analysisData, setAnalysisData]         = useState<AnalysisData | null>(null);
  const [analysisVideo, setAnalysisVideo]       = useState<VideoItem | null>(null);
  const [expandedLesson, setExpandedLesson]     = useState<string | null>(null);
  const [checkedItems, setCheckedItems]         = useState<Record<string, boolean>>({});
  // Map videoId → analysisId (for PDF links)
  const [analysisIdMap, setAnalysisIdMap]       = useState<Record<string, string>>({});
  // Sort order
  const [sortOldest, setSortOldest]             = useState(true);
  // Tooltip for quality reasons
  const [qualityTip, setQualityTip]             = useState<string | null>(null);
  // Videos whose Cloudinary thumbnail failed to load (no actual video file)
  const [brokenVideoIds, setBrokenVideoIds]     = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming]         = useState(false);
  // Pagination
  const [pageSize, setPageSize]   = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const childId = childIdParam.trim();
    const start = startDateParam.trim();
    const end = endDateParam.trim();
    const location = locationParam.trim();
    const age = ageParam.trim();

    if (childId) setSearchChildId(childId);
    if (start) setStartDate(start);
    if (end) setEndDate(end);
    if (location) setLocationFilter(location);
    if (age) setAgeFilter(age);
  }, [childIdParam, startDateParam, endDateParam, locationParam, ageParam]);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [videoSnap, childrenSnap] = await Promise.all([
          getDocs(collection(db, "video_modeling")),
          getDocs(collection(db, "children")),
        ]);

        const childMap: Record<string, { name: string; birthday: string }> = {};
        childrenSnap.forEach((d) => {
          const data = d.data();
          childMap[d.id] = { name: data.name || d.id, birthday: data.birthday || "" };
        });
        setChildren(childMap);

        const list: VideoItem[] = [];
        videoSnap.forEach((d) => {
          const data = d.data();
          const cid = data.childid || data.childId;
          list.push({
            id: d.id,
            url: data.url,
            childId: cid || "Unknown",
            childName: childMap[cid]?.name || cid || "Trẻ không tên",
            role: data.role || "unknown",
            location: data.location || "Chưa xác định",
            createdAt: data.createdAt,
            topic: data.topic || "Video Modeling",
            status: data.status || "pending",
            duration: data.duration,
            primaryTag: data.primaryTag,
            context: data.context,
            category: data.category,
            parentNote: data.parentNote,
            expertNote: data.expertNote,
          });
        });

        list.sort((a, b) => {
          const da = (a.createdAt?.toDate?.() || new Date(a.createdAt)) as Date;
          const db2 = (b.createdAt?.toDate?.() || new Date(b.createdAt)) as Date;
          return db2.getTime() - da.getTime();
        });
        setVideos(list);
      } catch (err) {
        console.error("fetchData:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
  const filteredVideos = useMemo(() => {
    const filtered = videos.filter((v) => {
      // Hide cards with no playable video URL or confirmed-broken thumbnail
      const resolved = decodeUrl(v.url);
      if (!resolved.startsWith("http")) return false;
      if (brokenVideoIds.has(v.id)) return false;

      const matchChild =
        v.childName.toLowerCase().includes(searchChildId.toLowerCase()) ||
        v.childId.toLowerCase().includes(searchChildId.toLowerCase());
      const matchLocation = locationFilter === "all" || v.location === locationFilter;

      let matchAge = true;
      if (ageFilter !== "all" && children[v.childId]) {
        const by = new Date(children[v.childId].birthday).getFullYear();
        const age = new Date().getFullYear() - by;
        if (ageFilter === "le5") matchAge = age <= 5;
        if (ageFilter === "gt5") matchAge = age > 5;
      }

      const vDate = v.createdAt?.toDate?.() || new Date(v.createdAt);
      const matchStart = !startDate || vDate >= new Date(startDate);
      const matchEnd   = !endDate   || vDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999));

      return matchChild && matchLocation && matchAge && matchStart && matchEnd;
    });

    if (sortOldest) {
      filtered.sort((a, b) => {
        const da = (a.createdAt?.toDate?.() || new Date(a.createdAt)) as Date;
        const db2 = (b.createdAt?.toDate?.() || new Date(b.createdAt)) as Date;
        return da.getTime() - db2.getTime();
      });
    }
    return filtered;
  }, [videos, searchChildId, locationFilter, ageFilter, startDate, endDate, children, sortOldest, brokenVideoIds]);

  // Reset to page 1 whenever filters / sort change
  useEffect(() => { setCurrentPage(1); }, [filteredVideos]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / pageSize));
  const pagedVideos = useMemo(
    () => filteredVideos.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredVideos, currentPage, pageSize]
  );

  // ── Child detail modal ─────────────────────────────────────────────────────
  const openChildDetail = async (childId: string, childName: string) => {
    setSelectedChildId(childId);
    setSelectedChildName(childName);
    setIsDetailOpen(true);
    setPlans([]);
    setNotes([]);
    setLoadingDetail(true);
    try {
      const [plansSnap, notesSnap] = await Promise.all([
        getDocs(query(collection(db, "intervention_plans"), orderBy("uploadedAt", "desc"))),
        getDocs(query(collection(db, "professor_notes"),   orderBy("createdAt",  "desc"))),
      ]);
      setPlans(plansSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any)).filter((p) => p.childId === childId));
      setNotes(notesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any)).filter((n) => n.childId === childId));
    } catch (err) {
      console.error("loadDetail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUploadPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChildId) return;
    setUploadingPlan(true);
    setUploadProgress(0);
    try {
      const session = getAuthSession();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("childId", selectedChildId);
      formData.append("uploaderId", session?.userId || "");
      formData.append("uploaderName", session?.userName || "Chuyên gia");
      const interval = setInterval(() => setUploadProgress((p) => (p < 85 ? p + 5 : p)), 300);
      const res = await fetch("/api/upload-plan", { method: "POST", body: formData });
      clearInterval(interval);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload thất bại");
      const { id, url, name } = await res.json();
      setPlans((prev) => [{ id, name, url, uploadedAt: new Date(), uploaderName: session?.userName || "Chuyên gia" }, ...prev]);
      setUploadProgress(100);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Vui lòng thử lại"));
    } finally {
      setUploadingPlan(false);
    }
  };

  const handleSubmitNote = async () => {
    if (!newNote.trim() || !selectedChildId) return;
    try {
      const session = getAuthSession();
      const data = { childId: selectedChildId, content: newNote, authorId: session?.userId || "unknown", authorName: session?.userName || "Chuyên gia", createdAt: serverTimestamp() };
      const ref2 = await addDoc(collection(db, "professor_notes"), data);
      setNotes([{ id: ref2.id, ...data, createdAt: new Date() } as any, ...notes]);
      setNewNote("");
    } catch (err) { console.error(err); }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Xóa ghi chú này?")) return;
    await deleteDoc(doc(db, "professor_notes", id));
    setNotes(notes.filter((n) => n.id !== id));
  };

  const handleDeletePlan = async (id: string, url: string) => {
    if (!confirm("Xóa bài học này? File sẽ bị xóa vĩnh viễn.")) return;
    await deleteDoc(doc(db, "intervention_plans", id));
    if (url.includes("firebasestorage.googleapis.com")) {
      try { await deleteObject(ref(storage, url)); } catch { /* ok */ }
    }
    setPlans(plans.filter((p) => p.id !== id));
  };

  // ── AI Analysis ────────────────────────────────────────────────────────────
  const handleAnalyzeVideo = async (video: VideoItem) => {
    setAnalyzingVideoId(video.id);
    try {
      // ── Video đã được phân tích và lưu → load kết quả cũ, KHÔNG chạy lại ──
      if (video.status === "Đã phân tích") {
        const res = await fetch(`/api/analyze-video?videoId=${video.id}`);
        if (res.ok) {
          const data = await res.json();
          setAnalysisData(data as AnalysisData);
          setAnalysisVideo(video);
          setExpandedLesson(null);
          setCheckedItems({});
          // analysisId có thể được store là 'id' trong Firestore doc
          const aid = data.analysisId || data.id;
          if (aid) setAnalysisIdMap((prev) => ({ ...prev, [video.id]: aid }));
          return;
        }
        // GET thất bại → báo lỗi, KHÔNG fall-through chạy lại AI
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Không tải được kết quả phân tích (HTTP ${res.status}). Vui lòng thử lại.`);
      }

      // ── Video chưa phân tích → chạy AI mới ──
      const session = getAuthSession();
      const res = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, childId: video.childId, teacherId: session?.userId || "" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`${err.error || "Phân tích thất bại"}${err.detail ? `\n\nChi tiết: ${err.detail}` : ""}`);
      }

      const data = (await res.json()) as AnalysisData;
      setAnalysisData(data);
      setAnalysisVideo(video);
      setExpandedLesson(null);
      setCheckedItems({});

      if (data.analysisId) {
        setAnalysisIdMap((prev) => ({ ...prev, [video.id]: data.analysisId }));
      }
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Vui lòng thử lại"));
    } finally {
      setAnalyzingVideoId(null);
    }
  };

  const handleConfirmAnalysis = async () => {
    if (!analysisData || !analysisVideo || isConfirming) return;
    
    const aid = analysisData.analysisId;
    if (!aid) {
      alert("Không tìm thấy Analysis ID. Vui lòng phân tích lại.");
      return;
    }

    setIsConfirming(true);
    try {
      const session = getAuthSession();
      const res = await fetch("/api/analyze-video/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: aid,
          videoId: analysisVideo.id,
          childId: analysisVideo.childId,
          teacherId: session?.userId || "system",
        }),
      });

      if (!res.ok) throw new Error("Lưu kết quả thất bại");

      // Update local video status
      setVideos((prev) =>
        prev.map((v) => (v.id === analysisVideo.id ? { ...v, status: "Đã phân tích" } : v))
      );
      
      // Update analysisVideo status so button disappears
      setAnalysisVideo({ ...analysisVideo, status: "Đã phân tích" });
      
      alert("Đã lưu kết quả phân tích và tạo bài học can thiệp!");
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleChecklist = (key: string) =>
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Danh sách Video Modeling</h1>
          <p className="text-gray-500 font-medium">Quản lý và theo dõi bài tập can thiệp của tất cả các bé.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <div className="px-4 py-2 text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">Tổng video</p>
            <p className="text-xl font-black text-blue-600">{videos.length}</p>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="px-4 py-2 text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">Đã lọc</p>
            <p className="text-xl font-black text-emerald-600">{filteredVideos.length}</p>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="px-4 py-2 text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">Đã phân tích</p>
            <p className="text-xl font-black text-purple-600">{videos.filter((v) => v.status === "Đã phân tích").length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm theo tên bé hoặc mã ChildID..."
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-700 transition-all"
            value={searchChildId}
            onChange={(e) => setSearchChildId(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          {["all", "Tại nhà", "Tại trường"].map((loc) => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${locationFilter === loc ? "bg-white shadow-sm text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              {loc === "all" ? "Tất cả" : loc}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
          <span className="text-[10px] font-black text-gray-400 uppercase">Tuổi:</span>
          <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} className="bg-transparent border-none text-xs font-bold text-gray-600 focus:ring-0">
            <option value="all">Tất cả</option>
            <option value="le5">≤ 5 tuổi</option>
            <option value="gt5">&gt; 5 tuổi</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none p-0 text-xs font-bold text-gray-600 focus:ring-0" />
          <span className="text-gray-300">→</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none p-0 text-xs font-bold text-gray-600 focus:ring-0" />
        </div>
        <button
          onClick={() => setSortOldest((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black transition-all ${sortOldest ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-100 hover:border-blue-300"}`}
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortOldest ? "Cũ → Mới" : "Mới → Cũ"}
        </button>
        {/* Page size selector */}
        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
          <span className="text-[10px] font-black text-gray-400 uppercase">Hiện:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="bg-transparent border-none text-xs font-bold text-gray-600 focus:ring-0"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-[2rem] h-80 animate-pulse border border-gray-100" />
          ))
        ) : pagedVideos.length > 0 ? (
          pagedVideos.map((video) => {
            const quality = checkVideoQuality({
              url: video.url,
              childId: video.childId,
              duration: video.duration,
              topic: video.topic,
              category: video.category,
              primaryTag: video.primaryTag,
              parentNote: video.parentNote,
              expertNote: video.expertNote,
              status: video.status,
            });
            const eligible = quality.eligible;
            const pdfAnalysisId = analysisIdMap[video.id];

            return (
            <div
              key={video.id}
              className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-900 relative group-hover:scale-105 transition-transform duration-700">
                {/* Cloudinary thumbnail — hides card on error (video file missing) */}
                {(() => {
                  const thumb = getCloudinaryThumb(decodeUrl(video.url));
                  return thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={() => setBrokenVideoIds((prev) => new Set([...prev, video.id]))}
                    />
                  ) : null;
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setVideoPlayerUrl(decodeUrl(video.url))}
                    className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white hover:bg-white/30 hover:scale-110 transition-all border border-white/30 shadow-2xl"
                  >
                    <Play className="w-8 h-8 fill-current" />
                  </button>
                </div>
                <div className="absolute top-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/20">
                  {video.role === "parent" ? "Phụ huynh" : "Giáo viên"}
                </div>
                {/* Analyzed badge */}
                {video.status === "Đã phân tích" && (
                  <div className="absolute top-4 right-4 px-2 py-1 bg-purple-600/80 backdrop-blur-md rounded-full text-[10px] font-black text-white border border-purple-400/30 flex items-center gap-1">
                    <Brain className="w-3 h-3" /> AI
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-black text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{video.childName}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{video.childId}</p>
                  </div>
                  <button onClick={() => openChildDetail(video.childId, video.childName)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                    <FileSignature className="w-5 h-5" />
                  </button>
                </div>

                {/* Quality badge */}
                <div className="mb-3">
                  {eligible ? (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black">
                      <ShieldCheck className="w-3 h-3" /> Đạt chuẩn phân tích
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] font-black hover:bg-red-100 transition-colors"
                        onMouseEnter={() => setQualityTip(video.id)}
                        onMouseLeave={() => setQualityTip(null)}
                      >
                        <ShieldAlert className="w-3 h-3" /> Chưa đạt chuẩn
                      </button>
                      {qualityTip === video.id && (
                        <div className="absolute left-0 top-7 z-50 bg-gray-900 text-white text-[10px] font-bold rounded-xl p-3 w-60 shadow-xl leading-relaxed">
                          <p className="font-black text-red-300 mb-1">Lý do chưa đạt:</p>
                          <ul className="space-y-1">
                            {quality.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                          </ul>
                          {quality.warnings.length > 0 && (
                            <>
                              <p className="font-black text-amber-300 mt-2 mb-1">Cảnh báo:</p>
                              <ul className="space-y-1">
                                {quality.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <MapPin className="w-4 h-4 text-blue-500" /><span>{video.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>{video.createdAt?.toDate?.() ? video.createdAt.toDate().toLocaleDateString("vi-VN") : new Date(video.createdAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="pt-4 border-t border-gray-50 flex items-center gap-2">
                  <button
                    onClick={() => eligible ? handleAnalyzeVideo(video) : undefined}
                    disabled={analyzingVideoId === video.id || !eligible}
                    title={!eligible ? "Video chưa đủ điều kiện phân tích" : undefined}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${
                      !eligible
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : video.status === "Đã phân tích"
                        ? "bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white"
                        : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 shadow-lg shadow-blue-500/20"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {analyzingVideoId === video.id ? (
                      <><Activity className="w-4 h-4 animate-pulse" /> Đang phân tích...</>
                    ) : !eligible ? (
                      <><ShieldAlert className="w-4 h-4" /> Chưa đủ điều kiện</>
                    ) : video.status === "Đã phân tích" ? (
                      <><Brain className="w-4 h-4" /> Xem phân tích</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Phân tích AI</>
                    )}
                  </button>
                  {video.status === "Đã phân tích" && pdfAnalysisId && (
                    <a
                      href={`/api/generate-report?analysisId=${pdfAnalysisId}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Tải báo cáo PDF"
                      className="p-2.5 bg-orange-50 text-orange-500 rounded-2xl hover:bg-orange-500 hover:text-white transition-all"
                    >
                      <FileDown className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => openChildDetail(video.childId, video.childName)}
                    className="p-2.5 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 bg-white rounded-[3rem] border border-gray-100 text-center flex flex-col items-center justify-center">
            <Search className="w-8 h-8 text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold">Không tìm thấy video nào.</p>
            <button onClick={() => { setSearchChildId(""); setLocationFilter("all"); }} className="mt-4 text-blue-600 text-sm font-black underline">Xóa lọc</button>
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────────── */}
      {!loading && filteredVideos.length > 0 && (
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400">
            Hiển thị <span className="text-gray-700 font-black">{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredVideos.length)}</span> trong <span className="text-gray-700 font-black">{filteredVideos.length}</span> video
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-2xl border border-gray-100 text-xs font-black text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← Trước
            </button>
            {/* Page number chips — show max 7 around current page */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-300 font-black text-xs">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item as number)}
                    className={`w-9 h-9 rounded-2xl text-xs font-black transition-all ${
                      currentPage === item
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 border border-gray-100"
                    }`}
                  >
                    {item}
                  </button>
                )
              )
            }
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-2xl border border-gray-100 text-xs font-black text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Sau →
            </button>
          </div>
        </div>
      )}

      {/* ── Analysis Modal ──────────────────────────────────────────────────── */}
      {analysisData && analysisVideo && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center lg:p-4 p-0">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => setAnalysisData(null)} />
          <div className="relative bg-white w-full lg:max-w-7xl h-full lg:h-[95vh] lg:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-900 to-blue-900 text-white flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight">{analysisVideo.childName}</h2>
                  <p className="text-xs text-white/50 font-bold uppercase">{analysisVideo.childId} · {analysisVideo.topic}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Regulation badge */}
                {(() => {
                  const cfg = REGULATION_CONFIG[analysisData.summary.regulationLevel] ?? REGULATION_CONFIG.transitioning;
                  return (
                    <span className={`px-4 py-2 rounded-2xl text-xs font-black uppercase ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  );
                })()}
                {/* PDF report button */}
                {(() => {
                  const aid = analysisData.analysisId || (analysisVideo && analysisIdMap[analysisVideo.id]);
                  return aid ? (
                    <a
                      href={`/api/generate-report?analysisId=${aid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500 text-orange-200 hover:text-white rounded-2xl text-xs font-black uppercase transition-all border border-orange-400/30"
                    >
                      <FileDown className="w-4 h-4" /> Báo cáo PDF
                    </a>
                  ) : null;
                })()}

                {/* Confirm/Save Button */}
                {analysisVideo.status !== "Đã phân tích" && (
                  <button
                    onClick={handleConfirmAnalysis}
                    disabled={isConfirming}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-400 text-white rounded-2xl text-xs font-black uppercase transition-all shadow-lg shadow-emerald-900/20 border border-emerald-400/30"
                  >
                    {isConfirming ? (
                      <><Activity className="w-4 h-4 animate-spin" /> Đang lưu...</>
                    ) : (
                      <><CheckSquare className="w-4 h-4" /> Lưu kết quả</>
                    )}
                  </button>
                )}

                <button onClick={() => setAnalysisData(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all hover:rotate-90 border border-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Key Insights strip */}
            <div className="flex gap-4 px-8 py-4 bg-slate-50 border-b border-gray-100 overflow-x-auto flex-shrink-0">
              {analysisData.summary.keyInsights.map((insight, i) => (
                <div key={i} className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{insight}</span>
                </div>
              ))}
            </div>

            {/* Body: 2 columns */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

              {/* Left: Segments + HPDT */}
              <div className="w-full lg:w-[38%] lg:border-r border-gray-100 overflow-y-auto p-6 space-y-6">

                {/* Video Quality Assessment */}
                {analysisData.frameAnalysis?.videoQuality && (() => {
                  const vq = analysisData.frameAnalysis.videoQuality;
                  const LIGHTING_LABEL: Record<string, string> = { good: "Đủ sáng", acceptable: "Hơi tối", poor: "Tối quá" };
                  const SHARPNESS_LABEL: Record<string, string> = { sharp: "Nét rõ", acceptable: "Hơi mờ", blurry: "Mờ quá" };
                  const LIGHTING_COLOR: Record<string, string> = { good: "text-emerald-600 bg-emerald-50", acceptable: "text-amber-600 bg-amber-50", poor: "text-red-600 bg-red-50" };
                  const SHARPNESS_COLOR: Record<string, string> = { sharp: "text-emerald-600 bg-emerald-50", acceptable: "text-amber-600 bg-amber-50", blurry: "text-red-600 bg-red-50" };
                  return (
                    <div className={`rounded-[1.5rem] border p-4 shadow-sm ${vq.overallPass ? "border-emerald-100 bg-emerald-50/50" : "border-amber-200 bg-amber-50"}`}>
                      <h4 className="text-xs font-black text-gray-700 flex items-center gap-2 mb-3 uppercase tracking-widest">
                        <Video className="w-4 h-4 text-gray-400" /> Chất lượng Video
                        {vq.overallPass
                          ? <span className="ml-auto text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">✓ Đạt</span>
                          : <span className="ml-auto text-[10px] font-black text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">⚠ Có vấn đề</span>
                        }
                      </h4>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className={`rounded-xl px-3 py-2 text-center ${LIGHTING_COLOR[vq.lighting] ?? "bg-gray-50 text-gray-500"}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Ánh sáng</p>
                          <p className="text-xs font-black">{LIGHTING_LABEL[vq.lighting] ?? vq.lighting}</p>
                        </div>
                        <div className={`rounded-xl px-3 py-2 text-center ${SHARPNESS_COLOR[vq.sharpness] ?? "bg-gray-50 text-gray-500"}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Độ nét</p>
                          <p className="text-xs font-black">{SHARPNESS_LABEL[vq.sharpness] ?? vq.sharpness}</p>
                        </div>
                        <div className={`rounded-xl px-3 py-2 text-center ${vq.frontView ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-400"}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Chính diện</p>
                          <p className="text-xs font-black">{vq.frontView ? "✓ Có" : "✗ Không"}</p>
                        </div>
                        <div className={`rounded-xl px-3 py-2 text-center ${vq.sideView45 ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-400"}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Góc 45°</p>
                          <p className="text-xs font-black">{vq.sideView45 ? "✓ Có" : "✗ Không"}</p>
                        </div>
                      </div>
                      {vq.warnings?.length > 0 && (
                        <ul className="space-y-1">
                          {vq.warnings.map((w: string, i: number) => (
                            <li key={i} className="text-[10px] font-bold text-amber-800 flex items-start gap-1.5">
                              <span className="flex-shrink-0 mt-0.5">⚠</span> {w}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}

                {/* HPDT scores */}
                <div className="bg-white rounded-[1.5rem] border border-gray-100 p-5 shadow-sm">
                  <h4 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
                    <BarChart2 className="w-4 h-4 text-blue-500" /> Điểm HPDT từ Video
                  </h4>
                  {analysisData.frameAnalysis?.hpdt && (
                    <div className="space-y-3">
                      {(["social","cognitive","behavior","sensory","motor"] as const).map((key) => {
                        const labels: Record<string, string> = { social: "Xã hội", cognitive: "Nhận thức", behavior: "Hành vi", sensory: "Giác quan", motor: "Vận động" };
                        const val = analysisData.frameAnalysis.hpdt[key];
                        return (
                          <div key={key}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs font-bold text-gray-500">{labels[key]}</span>
                              <span className="text-xs font-black text-gray-700">{val}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all" style={{ width: `${val}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-black text-gray-500 uppercase">Tổng thể</span>
                        <span className="text-lg font-black text-blue-600">{analysisData.frameAnalysis.hpdt.overall}/100</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Segments timeline */}
                <div className="bg-white rounded-[1.5rem] border border-gray-100 p-5 shadow-sm">
                  <h4 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-purple-500" /> Chặng hành vi
                  </h4>
                  <div className="space-y-3">
                    {analysisData.segments.map((seg) => (
                      <div key={seg.segmentId} className="rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                        <div className={`h-1.5 ${MOTION_COLOR[seg.motionLevel] ?? "bg-gray-400"}`} />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-sm font-black text-gray-800">{seg.behaviorLabel}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex-shrink-0 ${
                              seg.motionLevel === "high" ? "bg-red-100 text-red-700" :
                              seg.motionLevel === "medium" ? "bg-amber-100 text-amber-700" :
                              "bg-emerald-100 text-emerald-700"
                            }`}>
                              {MOTION_LABEL[seg.motionLevel]} · {seg.motionScore}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{seg.startTime}s – {seg.endTime}s</p>
                          <p className="text-xs text-gray-600 leading-relaxed mb-2">{seg.functionalAnalysis}</p>
                          <div className="bg-blue-50 rounded-xl p-2">
                            <p className="text-xs font-bold text-blue-700">💡 {seg.interventionHint}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overall recommendation */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[1.5rem] border border-indigo-100 p-5">
                  <h4 className="text-sm font-black text-indigo-700 flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4" /> Khuyến nghị tổng thể
                  </h4>
                  <p className="text-sm text-indigo-800 leading-relaxed">{analysisData.summary.overallRecommendation}</p>
                </div>
              </div>

              {/* Right: Intervention plan */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-500" />
                    Kế hoạch can thiệp
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">
                      {analysisData.interventionPlan.lessons.length} bài học
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    {analysisData.interventionPlan.approach.map((a) => (
                      <span key={a} className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-lg">{a}</span>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {analysisData.interventionPlan.lessons.map((lesson) => {
                    const isOpen = expandedLesson === lesson.lessonId;
                    const checkedCount = lesson.checklist.filter((item) => checkedItems[`${lesson.lessonId}_${item.itemId}`]).length;
                    return (
                      <div key={lesson.lessonId} className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
                        {/* Lesson header */}
                        <button
                          className="w-full p-5 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors text-left"
                          onClick={() => setExpandedLesson(isOpen ? null : lesson.lessonId)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-2xl flex items-center justify-center text-white flex-shrink-0 text-sm font-black shadow-lg">
                              {analysisData.interventionPlan.lessons.indexOf(lesson) + 1}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-gray-800">{lesson.title}</h4>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg">{(lesson.lessonType || "").replace(/_/g, " ")}</span>
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-black rounded-lg">{(lesson.vmType || "").replace(/_/g, " ")}</span>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-black rounded-lg">{lesson.estimatedSessions || 0} buổi</span>
                                <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg ${lesson.forRole === "parent" ? "bg-pink-100 text-pink-700" : lesson.forRole === "teacher" ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"}`}>
                                  {lesson.forRole === "parent" ? "Phụ huynh" : lesson.forRole === "teacher" ? "Giáo viên" : "Cả hai"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{lesson.rationale}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-bold text-gray-400">{checkedCount}/{lesson.checklist.length}</span>
                            {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </div>
                        </button>

                        {/* Lesson body */}
                        {isOpen && (
                          <div className="border-t border-gray-100">
                            {/* Steps */}
                            {lesson.steps.length > 0 && (
                              <div className="p-5 border-b border-gray-100">
                                <h5 className="text-xs font-black text-gray-600 uppercase mb-3 flex items-center gap-2">
                                  <ListChecks className="w-4 h-4 text-blue-500" /> Các bước thực hiện
                                </h5>
                                <div className="space-y-3">
                                  {lesson.steps.map((step) => (
                                    <div key={step.stepId} className="flex gap-3">
                                      <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{step.order}</div>
                                      <div className="flex-1">
                                        <p className="text-sm font-black text-gray-700">{step.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                                        <div className="flex flex-wrap gap-2 mt-1.5">
                                          <span className="text-[10px] font-bold text-gray-400">⏱ {step.duration}p</span>
                                          <span className="text-[10px] font-bold text-blue-500">GV: {step.therapistAction}</span>
                                          <span className="text-[10px] font-bold text-emerald-600">Trẻ: {step.childAction}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Checklist */}
                            {lesson.checklist.length > 0 && (
                              <div className="p-5">
                                <h5 className="text-xs font-black text-gray-600 uppercase mb-3 flex items-center gap-2">
                                  <CheckSquare className="w-4 h-4 text-emerald-500" /> Checklist buổi học
                                  <span className="ml-auto text-emerald-600">{checkedCount}/{lesson.checklist.length} hoàn thành</span>
                                </h5>
                                {/* Progress bar */}
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${lesson.checklist.length > 0 ? (checkedCount / lesson.checklist.length) * 100 : 0}%` }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  {lesson.checklist.map((item) => {
                                    const key = `${lesson.lessonId}_${item.itemId}`;
                                    const done = !!checkedItems[key];
                                    return (
                                      <button
                                        key={item.itemId}
                                        onClick={() => toggleChecklist(key)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${done ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100 hover:border-gray-200"}`}
                                      >
                                        {done ? (
                                          <CheckSquare className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                        ) : (
                                          <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                        )}
                                        <div className="flex-1">
                                          <p className={`text-xs font-bold ${done ? "line-through text-gray-400" : "text-gray-700"}`}>{item.description}</p>
                                          <span className={`text-[10px] font-black ${
                                            item.category === "target" ? "text-blue-500" :
                                            item.category === "prerequisite" ? "text-amber-500" : "text-purple-500"
                                          }`}>
                                            {item.category === "target" ? "Mục tiêu" : item.category === "prerequisite" ? "Tiên quyết" : "Tổng quát"} · {item.masteryTarget}%
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Collaboration message */}
                {analysisData.interventionPlan.collaborationMessage && (
                  <div className="mt-6 bg-gradient-to-br from-pink-50 to-orange-50 rounded-[1.5rem] border border-pink-100 p-5">
                    <h4 className="text-sm font-black text-pink-700 flex items-center gap-2 mb-3">
                      <Send className="w-4 h-4" /> Thông điệp gửi phụ huynh
                    </h4>
                    <p className="text-sm text-pink-800 leading-relaxed italic">"{analysisData.interventionPlan.collaborationMessage}"</p>
                    {analysisData.taskId && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-600">
                        <CheckSquare className="w-4 h-4" /> Đã gửi cho phụ huynh
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Child Detail Modal ───────────────────────────────────────────────── */}
      {isDetailOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center lg:p-4 p-0">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsDetailOpen(false)} />
          <div className="relative bg-white w-full lg:max-w-6xl h-full lg:h-[90vh] lg:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900">{selectedChildName}</h2>
                  <span className="text-sm font-bold text-gray-400">ChildID: {selectedChildId}</span>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-400 hover:rotate-90 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left: Plans */}
              <div className="w-full lg:w-[45%] lg:p-10 p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-gray-100 bg-slate-50/30">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-indigo-500" /> Bài học Can thiệp
                  </h3>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPlan} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all">
                    <Upload className="w-4 h-4" />
                    {uploadingPlan ? `Đang tải ${Math.round(uploadProgress)}%` : "Upload Word"}
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".doc,.docx" onChange={handleUploadPlan} />
                </div>
                {uploadingPlan && (
                  <div className="mb-6 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
                {loadingDetail ? (
                  <div className="space-y-4">{Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
                ) : plans.length > 0 ? (
                  <div className="space-y-4">
                    {plans.map((plan) => (
                      <div key={plan.id} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-gray-800 line-clamp-1">{plan.name}</h4>
                              <p className="text-[10px] font-bold text-gray-400">{plan.uploadedAt?.toDate ? plan.uploadedAt.toDate().toLocaleString("vi-VN") : new Date(plan.uploadedAt).toLocaleString("vi-VN")}</p>
                              <p className="text-[10px] font-black text-indigo-500 mt-1 uppercase">Up: {plan.uploaderName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setPreviewPlanId(plan.id); setPreviewFileUrl(plan.url); }} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                              <Eye className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleDeletePlan(plan.id, plan.url)} className="p-3 bg-gray-50 text-gray-300 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-[2rem] p-12 text-center">
                    <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-bold text-sm">Chưa có bài học nào.</p>
                  </div>
                )}
              </div>

              {/* Right: Notes */}
              <div className="w-full lg:w-1/2 lg:p-8 p-6 flex flex-col overflow-hidden">
                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-8">
                  <MessageSquare className="w-5 h-5 text-emerald-500" /> Ghi chú từ Chuyên gia
                </h3>
                <div className="bg-gray-50 p-6 rounded-[2rem] mb-8 border border-gray-100">
                  <textarea
                    placeholder="Nhập ghi chú quan sát lâm sàng..."
                    className="w-full bg-transparent border-none p-0 text-sm font-medium text-gray-700 focus:ring-0 min-h-[100px] placeholder:text-gray-300"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <div className="flex justify-end mt-4">
                    <button onClick={handleSubmitNote} className="px-6 py-2 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-emerald-600/20 hover:scale-105 transition-all">
                      Lưu ghi chú
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-6 px-2">
                  {notes.map((note) => (
                    <div key={note.id} className="relative pl-6 border-l-2 border-gray-100">
                      <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-emerald-500" />
                      <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="text-xs font-black text-emerald-600 uppercase">{note.authorName}</span>
                            <span className="text-[10px] font-bold text-gray-400 block">{note.createdAt?.toDate ? note.createdAt.toDate().toLocaleString("vi-VN") : new Date(note.createdAt).toLocaleString("vi-VN")}</span>
                          </div>
                          <button onClick={() => handleDeleteNote(note.id)} className="p-2 text-gray-200 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed font-medium">{note.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview */}
      {previewPlanId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
          <div className="absolute top-8 right-8 z-[210] flex gap-4">
            {previewFileUrl && (
              <a href={previewFileUrl} target="_blank" rel="noreferrer" className="bg-emerald-600 p-4 rounded-2xl text-white shadow-xl hover:scale-110 transition-all">
                <Download className="w-6 h-6" />
              </a>
            )}
            <button onClick={() => { setPreviewPlanId(null); setPreviewFileUrl(null); }} className="bg-white/10 p-4 rounded-2xl text-white backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all hover:rotate-90">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="w-full max-w-5xl h-full bg-white rounded-[2rem] overflow-hidden shadow-2xl">
            <iframe src={`/api/view-plan?id=${previewPlanId}`} className="w-full h-full border-none" title="Xem nội dung bài học" />
          </div>
        </div>
      )}

      {/* Video Player */}
      {videoPlayerUrl && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-10">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setVideoPlayerUrl(null)} />
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10">
            <button onClick={() => setVideoPlayerUrl(null)} className="absolute top-6 right-6 z-10 p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all hover:rotate-90 border border-white/10">
              <X className="w-6 h-6" />
            </button>
            <video src={videoPlayerUrl} controls autoPlay className="w-full h-full object-contain" />
            <div className="absolute bottom-6 left-6 right-6 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center pointer-events-none">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white font-black text-lg tracking-tight">Đang phát Video Modeling</p>
                  <p className="text-white/50 text-xs font-bold uppercase tracking-widest">AI4Autism</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar{width:6px}.custom-scrollbar::-webkit-scrollbar-track{background:transparent}.custom-scrollbar::-webkit-scrollbar-thumb{background-color:rgba(156,163,175,0.3);border-radius:20px}` }} />
    </div>
  );
}
