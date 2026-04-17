"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, orderBy, doc, getDoc, addDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { getAuthSession } from "@/lib/auth-session";
import { 
  Search, Filter, Calendar, MapPin, User, FileText, Upload, 
  ChevronRight, Play, Eye, X, MessageSquare, Plus, FileSignature,
  FileCode, CheckCircle2, Clock, MoreVertical, Download, Video
} from "lucide-react";

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

export default function VideoListPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [children, setChildren] = useState<Record<string, {name: string, birthday: string}>>({});
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchChildId, setSearchChildId] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detail Modal
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedChildName, setSelectedChildName] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Detail Content
  const [plans, setPlans] = useState<InterventionPlan[]>([]);
  const [notes, setNotes] = useState<ProfessorNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const decodeBase64 = (str: string) => {
    try {
      if (!str) return "";
      // Check if it's already a URL
      if (str.startsWith('http')) return str;
      return atob(str);
    } catch (e) {
      return str;
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [videoSnap, childrenSnap] = await Promise.all([
          getDocs(collection(db, "video_modeling")),
          getDocs(collection(db, "children"))
        ]);

        const childMap: Record<string, {name: string, birthday: string}> = {};
        childrenSnap.forEach(doc => {
          const data = doc.data();
          childMap[doc.id] = {
            name: data.name || doc.id,
            birthday: data.birthday || ""
          };
        });
        setChildren(childMap);

        const videoList: VideoItem[] = [];
        videoSnap.forEach(doc => {
          const data = doc.data();
          const cid = data.childid || data.childId;
          videoList.push({
            id: doc.id,
            url: data.url,
            childId: cid || "Unknown",
            childName: childMap[cid]?.name || cid || "Trẻ không tên",
            role: data.role || "unknown",
            location: data.location || "Chưa xác định",
            createdAt: data.createdAt,
            topic: data.topic || "Video Modeling",
            status: data.status || "Đã tải lên"
          });
        });

        // Sort by date desc
        videoList.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateB - dateA;
        });

        setVideos(videoList);
      } catch (error) {
        console.error("Error fetching video list:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchChild = v.childName.toLowerCase().includes(searchChildId.toLowerCase()) || 
                         v.childId.toLowerCase().includes(searchChildId.toLowerCase());
      const matchLocation = locationFilter === "all" || v.location === locationFilter;
      
      // Age Filter
      let matchAge = true;
      if (ageFilter !== "all" && children[v.childId]) {
        const birthday = children[v.childId].birthday;
        if (birthday) {
          const birthYear = new Date(birthday).getFullYear();
          const currentYear = new Date().getFullYear();
          const age = currentYear - birthYear;
          if (ageFilter === "le5") matchAge = age <= 5;
          if (ageFilter === "gt5") matchAge = age > 5;
        }
      }

      const vDate = v.createdAt?.toDate?.() || new Date(v.createdAt);
      const matchStart = !startDate || vDate >= new Date(startDate);
      const matchEnd = !endDate || vDate <= new Date(new Date(endDate).setHours(23,59,59,999));
      
      return matchChild && matchLocation && matchAge && matchStart && matchEnd;
    });
  }, [videos, searchChildId, locationFilter, ageFilter, startDate, endDate, children]);

  const openChildDetail = async (childId: string, childName: string) => {
    setSelectedChildId(childId);
    setSelectedChildName(childName);
    setIsDetailOpen(true);
    setPlans([]);
    setNotes([]);
    setLoadingDetail(true);

    try {
      // Fetch Plans
      const plansSnap = await getDocs(query(collection(db, "intervention_plans"), orderBy("uploadedAt", "desc")));
      const childPlans = plansSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(p => p.childId === childId);
      setPlans(childPlans);

      // Fetch Notes
      const notesSnap = await getDocs(query(collection(db, "professor_notes"), orderBy("createdAt", "desc")));
      const childNotes = notesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(n => n.childId === childId);
      setNotes(childNotes);
    } catch (err) {
      console.error("Error loading detail data:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleUploadPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChildId) return;

    setUploadingPlan(true);
    try {
      const session = getAuthSession();
      const storageRef = ref(storage, `intervention_plans/${selectedChildId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const planData = {
        childId: selectedChildId,
        name: file.name,
        url: downloadURL,
        uploadedAt: serverTimestamp(),
        uploaderId: session?.userId || "unknown",
        uploaderName: session?.userName || "Chuyên gia"
      };

      const docRef = await addDoc(collection(db, "intervention_plans"), planData);
      setPlans([{ id: docRef.id, ...planData, uploadedAt: new Date() } as any, ...plans]);
      
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Upload error:", err);
      alert("Lỗi khi tải file lên.");
    } finally {
      setUploadingPlan(false);
    }
  };

  const handleSubmitNote = async () => {
    if (!newNote.trim() || !selectedChildId) return;

    try {
      const session = getAuthSession();
      const noteData = {
        childId: selectedChildId,
        content: newNote,
        authorId: session?.userId || "unknown",
        authorName: session?.userName || "Chuyên gia",
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "professor_notes"), noteData);
      setNotes([{ id: docRef.id, ...noteData, createdAt: new Date() } as any, ...notes]);
      setNewNote("");
    } catch (err) {
      console.error("Error saving note:", err);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Stats */}
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
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm theo tên bé hoặc mã ChildID..." 
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-700 transition-all"
            value={searchChildId}
            onChange={e => setSearchChildId(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          <button 
            onClick={() => setLocationFilter("all")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${locationFilter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Tất cả
          </button>
          <button 
            onClick={() => setLocationFilter("Tại nhà")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${locationFilter === 'Tại nhà' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Tại nhà
          </button>
          <button 
            onClick={() => setLocationFilter("Tại trường")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${locationFilter === 'Tại trường' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Tại trường
          </button>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
          <span className="text-[10px] font-black text-gray-400 uppercase">Tuổi:</span>
          <select 
            value={ageFilter} 
            onChange={e => setAgeFilter(e.target.value)}
            className="bg-transparent border-none text-xs font-bold text-gray-600 focus:ring-0 appearance-none pr-6 relative"
          >
            <option value="all">Tất cả</option>
            <option value="le5">≤ 5 tuổi</option>
            <option value="gt5">&gt; 5 tuổi</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none p-0 text-xs font-bold text-gray-600 focus:ring-0" />
            <span className="text-gray-300">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none p-0 text-xs font-bold text-gray-600 focus:ring-0" />
          </div>
        </div>
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-[2rem] h-80 animate-pulse border border-gray-100" />
          ))
        ) : filteredVideos.length > 0 ? (
          filteredVideos.map((video) => (
            <div 
              key={video.id} 
              className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative"
            >
              {/* Thumbnail Placeholder */}
              <div className="aspect-video bg-gray-900 relative group-hover:scale-105 transition-transform duration-700">
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => setVideoPlayerUrl(decodeBase64(video.url))}
                     className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-white/30 hover:scale-110 transition-all border border-white/30 shadow-2xl"
                   >
                      <Play className="w-8 h-8 fill-current" />
                   </button>
                </div>
                <div className="absolute top-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/20">
                   {video.role === 'parent' ? 'Phụ huynh' : 'Giáo viên'}
                </div>
                <div className="absolute top-4 right-4 p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white">
                   <Clock className="w-4 h-4" />
                </div>
              </div>

              {/* Info Area */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{video.childName}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{video.childId}</p>
                  </div>
                  <button onClick={() => openChildDetail(video.childId, video.childName)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                    <FileSignature className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span>{video.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>{video.createdAt?.toDate?.() ? video.createdAt.toDate().toLocaleDateString('vi-VN') : new Date(video.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{video.status}</span>
                   </div>
                   <button 
                     onClick={() => openChildDetail(video.childId, video.childName)}
                     className="text-blue-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                   >
                      Quản lý <ChevronRight className="w-4 h-4" />
                   </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 bg-white rounded-[3rem] border border-gray-100 text-center flex flex-col items-center justify-center">
             <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-200" />
             </div>
             <p className="text-gray-400 font-bold">Không tìm thấy video nào.</p>
             <button onClick={() => { setSearchChildId(""); setLocationFilter("all"); }} className="mt-4 text-blue-600 text-sm font-black underline">Xóa lọc</button>
          </div>
        )}
      </div>

      {/* Child Detail Modal */}
      {isDetailOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsDetailOpen(false)} />
          <div className="relative bg-white w-full max-w-5xl h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
             
             {/* Modal Header */}
             <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="flex items-center gap-6 relative z-10">
                   <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                      <User className="w-8 h-8" />
                   </div>
                   <div>
                      <h2 className="text-2xl font-black text-gray-900">{selectedChildName}</h2>
                      <div className="flex items-center gap-3">
                         <span className="text-sm font-bold text-gray-400">ChildID: {selectedChildId}</span>
                         <div className="w-1 h-1 bg-gray-300 rounded-full" />
                         <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase">Hồ sơ lâm sàng</span>
                      </div>
                   </div>
                </div>
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-400 transition-all hover:rotate-90 relative z-20"
                >
                   <X className="w-6 h-6" />
                </button>
             </div>

             {/* Modal Body */}
             <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Intervention Plans */}
                <div className="w-1/2 p-8 overflow-y-auto custom-scrollbar border-r border-gray-50 bg-gray-50/20">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                         <FileCode className="w-5 h-5 text-indigo-500" />
                         Bài học Can thiệp
                      </h3>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPlan}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all"
                      >
                         <Upload className="w-4 h-4" />
                         {uploadingPlan ? 'Đang tải...' : 'Upload Word'}
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".doc,.docx" onChange={handleUploadPlan} />
                   </div>

                   {loadingDetail ? (
                      <div className="space-y-4">
                         {Array(3).fill(0).map((_, i) => (
                           <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
                         ))}
                      </div>
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
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">
                                           {plan.uploadedAt?.toDate ? plan.uploadedAt.toDate().toLocaleString('vi-VN') : new Date(plan.uploadedAt).toLocaleString('vi-VN')}
                                        </p>
                                        <p className="text-[10px] font-black text-indigo-500 mt-1 uppercase">Người up: {plan.uploaderName}</p>
                                     </div>
                                  </div>
                                  <button 
                                    onClick={() => setPreviewFileUrl(plan.url)}
                                    className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                                  >
                                     <Eye className="w-5 h-5" />
                                  </button>
                               </div>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-[2rem] p-12 text-center">
                         <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                         <p className="text-gray-400 font-bold text-sm">Chưa có bài học nào được tải lên.</p>
                      </div>
                   )}
                </div>

                {/* Right Side: Professor Notes */}
                <div className="w-1/2 p-8 flex flex-col overflow-hidden">
                   <h3 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-8">
                      <MessageSquare className="w-5 h-5 text-emerald-500" />
                      Ghi chú từ Chuyên gia
                   </h3>

                   {/* Add Note */}
                   <div className="bg-gray-50 p-6 rounded-[2rem] mb-8 border border-gray-100">
                      <textarea 
                        placeholder="Nhập ghi chú quan sát lâm sàng..." 
                        className="w-full bg-transparent border-none p-0 text-sm font-medium text-gray-700 focus:ring-0 min-h-[100px] placeholder:text-gray-300"
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                      />
                      <div className="flex justify-end mt-4">
                         <button 
                           onClick={handleSubmitNote}
                           className="px-6 py-2 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-emerald-600/20 hover:scale-105 transition-all"
                         >
                            Lưu ghi chú
                         </button>
                      </div>
                   </div>

                   {/* Notes List */}
                   <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-6">
                      {loadingDetail ? (
                         Array(2).fill(0).map((_, i) => (
                           <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
                         ))
                      ) : notes.length > 0 ? (
                         notes.map((note) => (
                            <div key={note.id} className="relative pl-6 border-l-2 border-gray-100">
                               <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-emerald-500" />
                               <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
                                  <div className="flex items-center justify-between mb-3">
                                     <span className="text-xs font-black text-emerald-600 uppercase">{note.authorName}</span>
                                     <span className="text-[10px] font-bold text-gray-400">
                                        {note.createdAt?.toDate ? note.createdAt.toDate().toLocaleString('vi-VN') : new Date(note.createdAt).toLocaleString('vi-VN')}
                                     </span>
                                  </div>
                                  <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                     {note.content}
                                  </p>
                               </div>
                            </div>
                         ))
                      ) : (
                        <div className="text-center py-10 opacity-50">
                           <p className="text-xs font-bold text-gray-400">Chưa có ghi chú nào.</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* File Preview Popup */}
      {previewFileUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
           <div className="absolute top-8 right-8 z-[210] flex gap-4">
              <a 
                href={previewFileUrl} 
                target="_blank" 
                rel="noreferrer"
                className="bg-emerald-600 p-4 rounded-2xl text-white shadow-xl hover:scale-110 transition-all"
                title="Tải về"
              >
                 <Download className="w-6 h-6" />
              </a>
              <button 
                onClick={() => setPreviewFileUrl(null)}
                className="bg-white/10 p-4 rounded-2xl text-white backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all hover:rotate-90"
              >
                 <X className="w-6 h-6" />
              </button>
           </div>
           
           <div className="w-full max-w-6xl h-full bg-white rounded-[2rem] overflow-hidden shadow-2xl relative">
              <iframe 
                src={`https://docs.google.com/gview?url=${encodeURIComponent(previewFileUrl)}&embedded=true`}
                className="w-full h-full border-none"
              />
              {/* Overlay Tip */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-900/80 backdrop-blur-lg rounded-2xl text-white flex items-center gap-3 shadow-2xl">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-sm font-bold tracking-tight">Trình xem trực tiếp Cloud. Chúc bạn một ngày làm việc hiệu quả!</span>
              </div>
           </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoPlayerUrl && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-10">
           <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setVideoPlayerUrl(null)} />
           <div className="relative w-full max-w-5xl aspect-video bg-black rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10">
              <button 
                onClick={() => setVideoPlayerUrl(null)}
                className="absolute top-6 right-6 z-10 p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all hover:rotate-90 border border-white/10"
              >
                 <X className="w-6 h-6" />
              </button>
              
              <video 
                src={videoPlayerUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
              
              {/* Info Overlay */}
              <div className="absolute bottom-6 left-6 right-6 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between pointer-events-none">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                       <Video className="w-6 h-6" />
                    </div>
                    <div>
                       <p className="text-white font-black text-lg tracking-tight">Đang phát Video Modeling</p>
                       <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Trình xem hệ thống AI4Autism</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 20px; }
      `}} />
    </div>
  );
}
