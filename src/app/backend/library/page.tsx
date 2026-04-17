"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, Loader2, RefreshCw, Sparkles, Trash2, Upload, BookOpen, CheckCircle 
} from "lucide-react";
import { 
  addDoc, collection, doc, getDocs, query, where, deleteDoc 
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { getLearnersForTeacher, type LearnerRecord } from "@/lib/services/learnerService";
import { getAuthSession } from "@/lib/auth-session";

// Define an interface for library items
interface LibraryItem {
  id: string;
  childId: string;
  fileName: string;
  fileUrl: string;
  foundExercises: string[];
  behaviors?: any[];
  uploadedBy: string;
  createdAt: string | number | Date | any;
}

export default function BackendLibraryIntakePage() {
  const router = useRouter();

  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const [adminId, setAdminId] = useState("");
  const [children, setChildren] = useState<LearnerRecord[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<LibraryItem[]>([]);
  
  const [lastResult, setLastResult] = useState<{ fileName: string; exercises: string[]; behaviors: any[] } | null>(null);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId]
  );

  const fetchDocuments = async (childId: string) => {
    setLoadingDocs(true);
    try {
      const docsSnap = await getDocs(query(collection(db, "child_exercises"), where("childId", "==", childId)));
      const rows: LibraryItem[] = docsSnap.docs
        .map((docSnap): LibraryItem => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            childId: data.childId,
            fileName: data.fileName || "Tài liệu chưa đặt tên",
            fileUrl: data.fileUrl,
            foundExercises: data.foundExercises || [],
            behaviors: data.behaviors || [],
            uploadedBy: data.uploadedBy || "admin",
            createdAt: data.createdAt,
          };
        })
        .sort((a, b) => {
          const timeA = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
          const timeB = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

      setDocuments(rows);
    } catch (fetchError) {
      console.error("Lỗi tải danh sách tài liệu:", fetchError);
      setError("Không tải được lịch sử thư viện tài liệu của bé.");
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    const session = getAuthSession();
    const legacyUserId = localStorage.getItem("userId") || "";
    const legacyRole = localStorage.getItem("userRole") || "teacher";

    const userId = session?.userId || legacyUserId;
    const userRole = session?.userRole || legacyRole;

    if (!session && !userId) {
      router.replace("/login");
      return;
    }

    setAdminId(userId);
    setLoadingBoot(false);
  }, [router]);

  useEffect(() => {
    if (!adminId) return;

    const fetchChildren = async () => {
      setLoadingChildren(true);
      setError("");
      try {
        // Fetch all learners to manage their library (assuming admin can see all)
        const learnerList = await getLearnersForTeacher(adminId, "admin");
        setChildren(learnerList);
        if (learnerList.length > 0) {
          setSelectedChildId((prev) => prev || learnerList[0].id);
        }
      } catch (loadError) {
        console.error("Lỗi tải danh sách bé:", loadError);
        setError("Không tải được danh sách bé cho quản trị viên.");
      } finally {
        setLoadingChildren(false);
      }
    };

    void fetchChildren();
  }, [adminId]);

  useEffect(() => {
    if (!selectedChildId) return;
    void fetchDocuments(selectedChildId);
  }, [selectedChildId]);

  const handleUpload = async () => {
    if (!selectedChild || !file || !adminId) {
      setError("Vui lòng chọn bé và chọn file trước khi tải lên.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(0);
    setLastResult(null);

    try {
      // Step 1: Upload to Firebase Storage
      const storageRef = ref(storage, `library/${selectedChild.id}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(progress);
          },
          (error) => reject(error),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      // Step 2: Use API to parse the Word document and extract exercises
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/library-scan", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Không thể xử lý phân tích file Word.");
      }

      const foundExercises = payload.foundExercises || [];
      const behaviors = payload.behaviors || [];

      // Step 3: Save metadata + parsed exercises/behaviors to Firestore
      const now = new Date();
      await addDoc(collection(db, "child_exercises"), {
        childId: selectedChild.id,
        childName: selectedChild.name,
        fileName: file.name,
        fileUrl: downloadUrl,
        storagePath: storageRef.fullPath,
        foundExercises,
        behaviors,
        uploadedBy: adminId,
        uploadedByRole: "admin",
        createdAt: now,
      });

      setLastResult({ fileName: file.name, exercises: foundExercises, behaviors });
      setFile(null);
      setUploadProgress(0);
      await fetchDocuments(selectedChild.id);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Không xác định";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, fileName: string) => {
    if (!selectedChildId) return;
    const confirmed = window.confirm(`Bạn có chắc muốn xóa tài liệu \"${fileName}\"?`);
    if (!confirmed) return;

    setDeletingDocId(docId);
    setError("");
    try {
      // Note: Ideal implementation would also delete the file from Storage using 'deleteObject' tracking 'storagePath'
      // But we will stick to basic Firestore document deletion for now to keep it safe.
      await deleteDoc(doc(db, "child_exercises", docId));
      await fetchDocuments(selectedChildId);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Không xác định";
      setError(`Xóa tài liệu thất bại: ${message}`);
    } finally {
      setDeletingDocId(null);
    }
  };

  if (loadingBoot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={36} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <BookOpen className="text-blue-600 w-8 h-8" />
          Thư viện Bài tập
        </h1>
        <p className="text-gray-500 mt-2 font-medium max-w-2xl">
          Tải lên các tài liệu tham khảo, bài giảng chuyên môn (Word/Text) theo từng bé. Hệ thống sẽ lưu trữ và tự động quét (scan) để tìm các từ khóa bài tập liên quan.
        </p>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Upload Panel */}
        <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-100 p-8 space-y-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Sparkles size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Cập nhật Tài liệu mới</h2>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-600">Hồ sơ trẻ đang xử lý</label>
            <select
              value={selectedChildId}
              onChange={(event) => setSelectedChildId(event.target.value)}
              disabled={loadingChildren || children.length === 0}
              className="w-full h-14 rounded-2xl border-2 border-gray-100 px-4 text-base font-bold text-gray-800 bg-gray-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              {children.length === 0 && <option value="">Đang tải thông tin...</option>}
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} ({child.id})
                </option>
              ))}
            </select>
          </div>

          <label className="block border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-3xl p-8 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 group">
            <input
              type="file"
              accept=".docx,.txt"
              className="hidden"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
              }}
            />
            <div className="w-16 h-16 rounded-full bg-white text-blue-500 mx-auto flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:text-blue-600 transition-transform duration-300">
              <Upload size={28} />
            </div>
            <p className="mt-4 text-base font-bold text-gray-800">Nhấn để chọn file Word</p>
            <p className="mt-1 text-sm font-medium text-gray-400">Hỗ trợ .docx hoặc .txt (Max 15MB)</p>
            {file && (
              <div className="mt-4 px-4 py-2 bg-blue-100/50 rounded-full inline-block">
                <p className="text-sm font-bold text-blue-700 truncate max-w-xs">
                  {file.name}
                </p>
              </div>
            )}
          </label>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedChildId || !file}
            className="w-full h-14 rounded-2xl bg-blue-600 text-white text-sm font-bold uppercase tracking-wider shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {uploading ? "Đang xử lý Storage & Scan..." : "Upload và Tạo Insights"}
          </button>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 flex items-start gap-3">
              <span className="shrink-0 mt-0.5">⚠️</span>
              {error}
            </div>
          )}

          {lastResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-3 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-100 rounded-full opacity-50"></div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-emerald-500 w-5 h-5" />
                <p className="text-sm uppercase tracking-widest font-black text-emerald-700">Scan hoàn tất</p>
              </div>
              <p className="text-base font-bold text-emerald-900">{lastResult.fileName}</p>
              <div>
                <p className="text-sm font-semibold text-emerald-800 mb-2">Từ khóa bài tập ({lastResult.exercises.length}):</p>
                {lastResult.exercises.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm text-emerald-700 space-y-1 mb-4">
                    {lastResult.exercises.map((ex, idx) => (
                      <li key={idx} className="font-medium">{ex}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-emerald-600 italic mb-4">Không phát hiện từ khóa bài tập định sẵn nào.</p>
                )}

                <p className="text-sm font-semibold text-blue-800 mb-2 mt-4 pt-4 border-t border-emerald-200/50">Phân tích hành vi bằng AI ({lastResult.behaviors.length}):</p>
                {lastResult.behaviors.length > 0 ? (
                  <div className="space-y-3 mt-2">
                    {lastResult.behaviors.map((beh, idx) => (
                      <div key={idx} className="bg-white/60 p-3 rounded-xl shadow-sm border border-emerald-100">
                        <p className="text-sm font-bold text-gray-800 mb-1">{beh.behavior}</p>
                        {beh.trigger && <p className="text-xs text-gray-600"><strong className="text-amber-600">Kích hoạt:</strong> {beh.trigger}</p>}
                        {beh.consequence && <p className="text-xs text-gray-600"><strong className="text-blue-600">Hệ quả:</strong> {beh.consequence}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-blue-600 italic">Không tìm thấy ghi nhận hành vi nào qua các bảng biểu.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* History Panel */}
        <div className="xl:col-span-3 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <FileText size={20} />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Lịch sử Tài liệu</h2>
            </div>
            <button
              onClick={() => selectedChildId && fetchDocuments(selectedChildId)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-2 border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <RefreshCw size={16} />
              Làm mới
            </button>
          </div>

          {loadingDocs ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="animate-spin text-blue-500" size={28} />
              <span className="font-medium text-sm">Đang tải hồ sơ...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 flex flex-col items-center justify-center text-center">
               <FileText className="w-12 h-12 text-gray-300 mb-4" />
               <p className="text-base font-bold text-gray-500">Thư mục trống</p>
               <p className="text-sm text-gray-400 mt-1">Hồ sơ trẻ này chưa có File bài tập nào được lưu trữ.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {documents.map((docItem) => (
                <div key={docItem.id} className="rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow bg-white flex flex-col sm:flex-row gap-4 sm:items-start group">
                  <div className="flex-1 space-y-3">
                    <p className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {docItem.fileName}
                    </p>
                    
                    <div className="flex flex-col gap-2">
                      {docItem.foundExercises?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {docItem.foundExercises.map((ex, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">
                              {ex}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {docItem.behaviors?.length > 0 && (
                        <div className="mt-1 flex flex-col gap-1">
                          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">{docItem.behaviors.length} hành vi / mốc ghi nhận</p>
                          <div className="flex flex-wrap gap-1.5">
                            {docItem.behaviors.map((b, idx) => (
                              <span key={idx} className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200 truncate max-w-[200px]" title={b.behavior}>
                                {b.behavior}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!docItem.foundExercises?.length && !docItem.behaviors?.length) && (
                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-lg self-start">
                          Chưa có insights
                        </span>
                      )}
                    </div>

                    <div className="flex gap-4 pt-1">
                      <a href={docItem.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:text-blue-700">
                        ↓ Tải xuống File gốc
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between shrink-0 h-full gap-3 sm:border-l border-gray-100 sm:pl-4">
                     <button
                        onClick={() => handleDeleteDocument(docItem.id, docItem.fileName)}
                        disabled={deletingDocId === docItem.id}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                        title="Xóa hồ sơ"
                      >
                        {deletingDocId === docItem.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
        }
      `}} />
    </div>
  );
}
