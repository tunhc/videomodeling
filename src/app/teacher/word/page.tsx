"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getAuthSession } from "@/lib/auth-session";
import { db } from "@/lib/firebase";
import { getLearnersForTeacher, type LearnerRecord } from "@/lib/services/learnerService";
import { buildWordInsightsFromText } from "@/lib/word-insights";

import { isAdminId } from "@/lib/constants";

function isAdminIdentity(userId: string, role: string) {
  return role === "admin" || isAdminId(userId);
}

type UploadResponse = {
  documentId?: string;
  childId: string;
  fileName: string;
  version?: number;
  wordCount: number;
  characterCount: number;
  preview: string;
  extractedText?: string;
  insights?: ReturnType<typeof buildWordInsightsFromText>;
  mimeType?: string;
  fileSize?: number;
  persisted?: boolean;
  requiresClientPersist?: boolean;
  parseWarnings: string[];
  createdAt: string;
};

type ChildDocumentRecord = {
  id: string;
  fileName: string;
  version?: number;
  wordCount?: number;
  characterCount?: number;
  preview?: string;
  uploadedBy?: string;
  createdAt?: unknown;
};

function hasToMillis(value: unknown): value is { toMillis: () => number } {
  return typeof value === "object" && value !== null && "toMillis" in value;
}

function toMillis(value: unknown) {
  if (!value) return 0;
  if (hasToMillis(value) && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}

function formatDateTime(value: unknown) {
  const millis = toMillis(value);
  if (!millis) return "Vừa cập nhật";
  return new Date(millis).toLocaleString("vi-VN");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function persistWordIntakeClientSide(input: {
  payload: UploadResponse;
  selectedChild: LearnerRecord;
  adminId: string;
  uploadedFile: File;
}) {
  const { payload, selectedChild, adminId, uploadedFile } = input;
  const now = new Date();

  const allChildDocsSnap = await getDocs(
    query(collection(db, "child_documents"), where("childId", "==", selectedChild.id))
  );

  const nextVersion =
    allChildDocsSnap.docs.filter((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return typeof data.fileName === "string" && data.fileName === payload.fileName;
    }).length + 1;

  const extractedText = typeof payload.extractedText === "string" ? payload.extractedText : "";
  const insights = payload.insights || buildWordInsightsFromText(extractedText);

  const documentPayload = {
    childId: selectedChild.id,
    childName: selectedChild.name,
    sourceType: "word_upload",
    fileName: payload.fileName,
    mimeType: payload.mimeType || uploadedFile.type || "application/octet-stream",
    fileSize: payload.fileSize || uploadedFile.size,
    version: nextVersion,
    extractedText,
    preview: payload.preview,
    wordCount: payload.wordCount,
    characterCount: payload.characterCount,
    analysis: insights,
    parseWarnings: payload.parseWarnings,
    status: "parsed",
    uploadedBy: adminId,
    uploadedByRole: "admin",
    createdAt: now,
    updatedAt: now,
  };

  const newDocRef = await addDoc(collection(db, "child_documents"), documentPayload);

  const latestWordDoc = {
    docId: newDocRef.id,
    fileName: payload.fileName,
    version: nextVersion,
    uploadedAt: now,
    wordCount: payload.wordCount,
    preview: payload.preview,
  };

  const latestWordInsights = {
    sourceDocId: newDocRef.id,
    fileName: payload.fileName,
    updatedAt: now,
    ...insights,
  };

  const childRef = doc(db, "children", selectedChild.id);
  const childSnap = await getDoc(childRef);

  if (childSnap.exists()) {
    await setDoc(
      childRef,
      {
        latestWordDoc,
        latestWordInsights,
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    const studentRef = doc(db, "students", selectedChild.id);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      await setDoc(
        studentRef,
        {
          latestWordDoc,
          latestWordInsights,
          updatedAt: now,
        },
        { merge: true }
      );
    }
  }

  await setDoc(
    doc(db, "hpdt_stats", selectedChild.id),
    {
      childId: selectedChild.id,
      latestWordInsights,
      lastWordDocAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    documentId: newDocRef.id,
    childId: selectedChild.id,
    fileName: payload.fileName,
    version: nextVersion,
    wordCount: payload.wordCount,
    characterCount: payload.characterCount,
    preview: payload.preview,
    parseWarnings: payload.parseWarnings,
    createdAt: now.toISOString(),
    persisted: true,
  } satisfies UploadResponse;
}

export default function AdminWordIntakePage() {
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
  const [documents, setDocuments] = useState<ChildDocumentRecord[]>([]);
  const [lastResult, setLastResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState("");

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId]
  );

  const fetchDocuments = async (childId: string) => {
    setLoadingDocs(true);
    try {
      const docsSnap = await getDocs(query(collection(db, "child_documents"), where("childId", "==", childId)));
      const rows: ChildDocumentRecord[] = docsSnap.docs
        .map((docSnap): ChildDocumentRecord => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            fileName: typeof data.fileName === "string" ? data.fileName : "Tài liệu chưa đặt tên",
            version: typeof data.version === "number" ? data.version : undefined,
            wordCount: typeof data.wordCount === "number" ? data.wordCount : undefined,
            characterCount: typeof data.characterCount === "number" ? data.characterCount : undefined,
            preview: typeof data.preview === "string" ? data.preview : undefined,
            uploadedBy: typeof data.uploadedBy === "string" ? data.uploadedBy : undefined,
            createdAt: data.createdAt,
          };
        })
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

      setDocuments(rows);
    } catch (fetchError) {
      console.error("Lỗi tải danh sách tài liệu:", fetchError);
      setError("Không tải được lịch sử tài liệu Word của bé.");
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

    if (!session || !userId) {
      router.replace("/login");
      return;
    }

    if (!isAdminIdentity(userId, userRole)) {
      router.replace("/teacher");
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

    try {
      const formData = new FormData();
      formData.append("childId", selectedChild.id);
      formData.append("childName", selectedChild.name);
      formData.append("uploadedBy", adminId);
      formData.append("uploadedByRole", "admin");
      formData.append("file", file);

      const response = await fetch("/api/admin/word-intake", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as UploadResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Không thể xử lý file Word.");
      }

      let finalPayload = payload;
      if (payload.requiresClientPersist) {
        finalPayload = await persistWordIntakeClientSide({
          payload,
          selectedChild,
          adminId,
          uploadedFile: file,
        });
      }

      setLastResult(finalPayload);
      setFile(null);
      await fetchDocuments(selectedChild.id);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Không xác định";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const updateLatestWordPointers = async (childId: string) => {
    const now = new Date();
    const docsSnap = await getDocs(query(collection(db, "child_documents"), where("childId", "==", childId)));

    const childRef = doc(db, "children", childId);
    const childSnap = await getDoc(childRef);

    const applyToLearner = async (payload: Record<string, unknown>) => {
      if (childSnap.exists()) {
        await setDoc(childRef, payload, { merge: true });
        return;
      }

      const studentRef = doc(db, "students", childId);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        await setDoc(studentRef, payload, { merge: true });
      }
    };

    if (docsSnap.empty) {
      await applyToLearner({
        latestWordDoc: deleteField(),
        latestWordInsights: deleteField(),
        updatedAt: now,
      });

      await setDoc(
        doc(db, "hpdt_stats", childId),
        {
          latestWordInsights: deleteField(),
          lastWordDocAt: deleteField(),
          updatedAt: now,
        },
        { merge: true }
      );
      return;
    }

    const latestDoc = docsSnap.docs
      .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as Record<string, unknown> }))
      .sort((a, b) => toMillis(b.data.createdAt) - toMillis(a.data.createdAt))[0];

    const latestData = latestDoc.data;
    const latestWordDoc = {
      docId: latestDoc.id,
      fileName: typeof latestData.fileName === "string" ? latestData.fileName : "Tài liệu chưa đặt tên",
      version: typeof latestData.version === "number" ? latestData.version : 1,
      uploadedAt: latestData.createdAt || now,
      wordCount: typeof latestData.wordCount === "number" ? latestData.wordCount : 0,
      preview: typeof latestData.preview === "string" ? latestData.preview : "",
    };

    const extractedText = typeof latestData.extractedText === "string" ? latestData.extractedText : "";
    const analysis = isRecord(latestData.analysis)
      ? latestData.analysis
      : extractedText
      ? (buildWordInsightsFromText(extractedText) as Record<string, unknown>)
      : null;

    const learnerPayload: Record<string, unknown> = {
      latestWordDoc,
      updatedAt: now,
    };

    const statsPayload: Record<string, unknown> = {
      updatedAt: now,
    };

    if (analysis) {
      const latestWordInsights = {
        sourceDocId: latestDoc.id,
        fileName: latestWordDoc.fileName,
        updatedAt: now,
        ...analysis,
      };

      learnerPayload.latestWordInsights = latestWordInsights;
      statsPayload.latestWordInsights = latestWordInsights;
      statsPayload.lastWordDocAt = now;
    } else {
      learnerPayload.latestWordInsights = deleteField();
      statsPayload.latestWordInsights = deleteField();
      statsPayload.lastWordDocAt = deleteField();
    }

    await applyToLearner(learnerPayload);
    await setDoc(doc(db, "hpdt_stats", childId), statsPayload, { merge: true });
  };

  const handleDeleteDocument = async (docId: string, fileName: string) => {
    if (!selectedChildId) return;
    const confirmed = window.confirm(`Bạn có chắc muốn xóa tài liệu \"${fileName}\"?`);
    if (!confirmed) return;

    setDeletingDocId(docId);
    setError("");
    try {
      await deleteDoc(doc(db, "child_documents", docId));
      await updateLatestWordPointers(selectedChildId);
      if (lastResult?.documentId === docId) {
        setLastResult(null);
      }
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
      <div className="min-h-screen bg-calming-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-calming-bg p-8 pb-32 space-y-8">
      <header className="bg-white border border-gray-100 rounded-[32px] p-6 sm:p-8 shadow-soft space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/teacher"
              className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500 flex items-center justify-center hover:text-primary hover:border-primary/30 transition-colors"
            >
              <ChevronLeft size={18} />
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Admin Intake</p>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Nạp Hồ Sơ Word vào hpDT</h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
            <ShieldCheck size={14} />
            Admin Only
          </div>
        </div>

        <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-4xl">
          Chọn bé, upload file Word (.docx) và hệ thống sẽ đọc nội dung, lưu vào thư viện tài liệu của bé,
          đồng thời cập nhật snapshot mới nhất để các màn hpDT có thể dùng tiếp.
        </p>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="xl:col-span-2 bg-white border border-gray-100 rounded-[32px] p-6 space-y-6 shadow-soft"
        >
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-primary" />
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-900">Upload tài liệu</h2>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chọn bé</label>
            <select
              value={selectedChildId}
              onChange={(event) => setSelectedChildId(event.target.value)}
              disabled={loadingChildren || children.length === 0}
              className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm font-bold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {children.length === 0 && <option value="">Không có dữ liệu</option>}
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} ({child.id})
                </option>
              ))}
            </select>
          </div>

          <label className="block border-2 border-dashed border-primary/20 bg-primary/5 rounded-[28px] p-6 text-center cursor-pointer hover:bg-primary/10 transition-colors">
            <input
              type="file"
              accept=".docx,.txt"
              className="hidden"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
              }}
            />
            <div className="w-12 h-12 rounded-2xl bg-white text-primary mx-auto flex items-center justify-center shadow-sm">
              <Upload size={22} />
            </div>
            <p className="mt-4 text-sm font-black text-gray-900">Nhấn để chọn file Word</p>
            <p className="mt-1 text-[10px] uppercase tracking-widest font-bold text-gray-400">Hỗ trợ .docx hoặc .txt</p>
            {file ? (
              <p className="mt-3 text-xs font-bold text-primary">
                Đã chọn: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </label>

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedChildId || !file}
            className="w-full h-12 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-hpdt disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {uploading ? "Đang đọc và lưu tài liệu" : "Upload và đọc nội dung"}
          </button>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          {lastResult ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700">Đã xử lý</p>
              <p className="text-sm font-bold text-emerald-900">{lastResult.fileName} • v{lastResult.version}</p>
              <p className="text-xs text-emerald-800">
                {lastResult.wordCount} từ • {lastResult.characterCount} ký tự
              </p>
            </div>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="xl:col-span-3 bg-white border border-gray-100 rounded-[32px] p-6 space-y-6 shadow-soft"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-900">Lịch sử tài liệu của bé</h2>
            <button
              onClick={() => selectedChildId && fetchDocuments(selectedChildId)}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary hover:border-primary/30 transition-colors"
            >
              <RefreshCw size={14} />
              Làm mới
            </button>
          </div>

          {loadingDocs ? (
            <div className="h-32 flex items-center justify-center text-gray-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-400">
              Chưa có tài liệu nào cho bé này.
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-2xl border border-gray-100 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-gray-900">{doc.fileName}</p>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">
                        {formatDateTime(doc.createdAt)} • {doc.uploadedBy || "admin"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-primary">v{doc.version || 1}</p>
                      <p className="text-[10px] text-gray-400 font-bold">
                        {(doc.wordCount || 0).toLocaleString("vi-VN")} từ
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                      disabled={deletingDocId === doc.id}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-red-200 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deletingDocId === doc.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      {deletingDocId === doc.id ? "Đang xóa" : "Xóa tài liệu"}
                    </button>
                  </div>

                  {doc.preview ? (
                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">
                      {doc.preview}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
}