"use client";

import { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { extractTeacherIds, mergeTeacherIds } from "@/lib/services/teacher-assignment";
import { AlertCircle, Baby, CheckCircle2, RefreshCw, Save, Shield, Users } from "lucide-react";

type TeacherSlots = [string, string, string];

interface TeacherOption {
  id: string;
  displayName: string;
  accountStatus: "active" | "inactive" | "unknown";
}

interface ChildRow {
  id: string;
  name: string;
  nickname: string;
  birthday: string;
  parentId: string;
  schoolCode: string;
  status: string;
  hpdt: number;
  teacherIds: string[];
}

interface ActionMessage {
  type: "success" | "error";
  text: string;
}

const EMPTY_TEACHER_SLOTS: TeacherSlots = ["", "", ""];

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9-]/g, "")
    .toUpperCase();
}

function inferCenterFromId(id: string): string {
  const parts = id.split("_");
  if (parts.length >= 2) return parts[1] || "";
  return "";
}

function parseDobDdMmYyyy(raw: string): string | null {
  const trimmed = raw.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);

  if (yyyy < 2000 || yyyy > new Date().getFullYear()) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;

  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return null;
  }

  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function deriveChildAlias(fullName: string): string {
  const cleaned = normalizeToken(fullName)
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BE";

  const last = parts[parts.length - 1].toLowerCase();
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function buildChildId(centerCode: string, childName: string, isoBirthday: string): string {
  const yearSuffix = isoBirthday.slice(2, 4);
  const alias = deriveChildAlias(childName);
  return `${centerCode}_${alias}-G${yearSuffix}`;
}

function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function formatDateValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const maybeDate = (value as { toDate?: () => Date }).toDate?.();
    if (maybeDate instanceof Date && !Number.isNaN(maybeDate.getTime())) {
      const yyyy = maybeDate.getFullYear();
      const mm = String(maybeDate.getMonth() + 1).padStart(2, "0");
      const dd = String(maybeDate.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return "";
}

function toTeacherSlots(ids: string[]): TeacherSlots {
  return [ids[0] || "", ids[1] || "", ids[2] || ""];
}

function normalizeTeacherIds(input: string[]): string[] {
  return mergeTeacherIds(
    input
      .map((id) => id.trim().toUpperCase())
      .filter(Boolean)
  ).slice(0, 3);
}

function isSameAssignments(left: string[], right: TeacherSlots): boolean {
  const normalizedRight = normalizeTeacherIds(right);
  if (left.length !== normalizedRight.length) return false;
  return left.every((id, index) => id === normalizedRight[index]);
}

export default function ChildManagementPage() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, TeacherSlots>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingChildId, setSavingChildId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [createChildName, setCreateChildName] = useState("");
  const [createChildDob, setCreateChildDob] = useState("");
  const [createChildGender, setCreateChildGender] = useState<"B" | "G">("B");
  const [createTeacherSlots, setCreateTeacherSlots] = useState<TeacherSlots>(EMPTY_TEACHER_SLOTS);
  const [createLoading, setCreateLoading] = useState(false);

  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);

  const teacherMap = useMemo(() => {
    return new Map(teachers.map((teacher) => [teacher.id, teacher]));
  }, [teachers]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, TeacherOption>();
    teachers.forEach((teacher) => {
      map.set(teacher.id, teacher);
    });

    children.forEach((child) => {
      child.teacherIds.forEach((teacherId) => {
        if (!map.has(teacherId)) {
          map.set(teacherId, {
            id: teacherId,
            displayName: teacherId,
            accountStatus: "unknown",
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      return a.displayName.localeCompare(b.displayName, "vi");
    });
  }, [children, teachers]);

  const filteredChildren = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    if (!queryText) return children;

    return children.filter((child) => {
      return (
        child.id.toLowerCase().includes(queryText) ||
        child.name.toLowerCase().includes(queryText) ||
        child.parentId.toLowerCase().includes(queryText) ||
        child.schoolCode.toLowerCase().includes(queryText)
      );
    });
  }, [children, searchQuery]);

  useEffect(() => {
    void fetchPageData(false);
  }, []);

  const fetchPageData = async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setActionMessage(null);

      const [childrenSnap, teachersSnap] = await Promise.all([
        getDocs(collection(db, "children")),
        getDocs(query(collection(db, "users"), where("role", "==", "teacher"))),
      ]);

      const teacherList: TeacherOption[] = teachersSnap.docs.map((item) => {
        const data = item.data() as Record<string, unknown>;
        const accountStatus = data.accountStatus === "inactive" || data.active === false ? "inactive" : "active";

        return {
          id: item.id,
          displayName:
            (typeof data.displayName === "string" && data.displayName.trim()) ||
            (typeof data.name === "string" && data.name.trim()) ||
            item.id,
          accountStatus,
        };
      });

      const childList: ChildRow[] = childrenSnap.docs
        .map((item) => {
          const data = item.data() as Record<string, unknown>;
          const extractedTeacherIds = extractTeacherIds(data);
          const teacherIds = normalizeTeacherIds(
            mergeTeacherIds(
              extractedTeacherIds,
              typeof data.teacherId === "string" ? [data.teacherId] : []
            )
          );

          return {
            id: item.id,
            name: typeof data.name === "string" && data.name.trim() ? data.name : item.id,
            nickname: typeof data.nickname === "string" ? data.nickname : "",
            birthday: formatDateValue(data.birthday || data.birthDay),
            parentId: typeof data.parentId === "string" ? data.parentId : "",
            schoolCode:
              (typeof data.schoolCode === "string" && data.schoolCode.trim()) || inferCenterFromId(item.id),
            status: typeof data.status === "string" && data.status.trim() ? data.status : "Bình thường",
            hpdt: typeof data.hpdt === "number" ? data.hpdt : 0,
            teacherIds,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));

      const nextDrafts: Record<string, TeacherSlots> = {};
      childList.forEach((child) => {
        nextDrafts[child.id] = toTeacherSlots(child.teacherIds);
      });

      setTeachers(teacherList.sort((a, b) => a.id.localeCompare(b.id)));
      setChildren(childList);
      setAssignmentDrafts(nextDrafts);
    } catch (error) {
      console.error("Error loading child management data:", error);
      setActionMessage({
        type: "error",
        text: "Không thể tải dữ liệu em bé/giáo viên. Vui lòng tải lại.",
      });
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleDraftChange = (childId: string, index: 0 | 1 | 2, value: string) => {
    setAssignmentDrafts((prev) => {
      const current = prev[childId] || toTeacherSlots([]);
      const next: TeacherSlots = [current[0], current[1], current[2]];
      next[index] = value;
      return {
        ...prev,
        [childId]: next,
      };
    });
  };

  const handleCreateTeacherSlotChange = (index: 0 | 1 | 2, value: string) => {
    setCreateTeacherSlots((prev) => {
      const next: TeacherSlots = [prev[0], prev[1], prev[2]];
      next[index] = value;
      return next;
    });
  };

  const handleSaveTeachers = async (child: ChildRow) => {
    const draftSlots = assignmentDrafts[child.id] || EMPTY_TEACHER_SLOTS;
    const nextTeacherIds = normalizeTeacherIds(draftSlots);

    if (nextTeacherIds.length === 0) {
      setActionMessage({ type: "error", text: `Bé ${child.name} cần ít nhất 1 giáo viên.` });
      return;
    }

    const unknownTeachers = nextTeacherIds.filter((teacherId) => !teacherMap.has(teacherId));
    if (unknownTeachers.length > 0) {
      setActionMessage({
        type: "error",
        text: `Không tìm thấy tài khoản GV: ${unknownTeachers.join(", ")}. Vui lòng chọn từ danh sách.`,
      });
      return;
    }

    const previousTeacherIds = normalizeTeacherIds(child.teacherIds);
    const toAdd = nextTeacherIds.filter((teacherId) => !previousTeacherIds.includes(teacherId));
    const toRemove = previousTeacherIds.filter((teacherId) => !nextTeacherIds.includes(teacherId));
    const primaryTeacherId = nextTeacherIds[0];
    const secondaryTeacherIds = nextTeacherIds.slice(1);

    setSavingChildId(child.id);
    setActionMessage(null);

    try {
      const batch = writeBatch(db);

      const childUpdatePayload: Record<string, unknown> = {
        teacherId: primaryTeacherId,
        teacherIds: nextTeacherIds,
        secondaryTeacherIds,
        updatedAt: serverTimestamp(),
      };

      childUpdatePayload.secondaryTeacherId = secondaryTeacherIds[0] || deleteField();

      batch.update(doc(db, "children", child.id), childUpdatePayload);

      if (child.parentId) {
        batch.set(
          doc(db, "users", child.parentId),
          {
            childId: child.id,
            teacherId: primaryTeacherId,
            teacherIds: nextTeacherIds,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      toAdd.forEach((teacherId) => {
        batch.set(
          doc(db, "users", teacherId),
          {
            childIds: arrayUnion(child.id),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      toRemove.forEach((teacherId) => {
        batch.set(
          doc(db, "users", teacherId),
          {
            childIds: arrayRemove(child.id),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      setChildren((prev) =>
        prev.map((item) =>
          item.id === child.id
            ? {
                ...item,
                teacherIds: nextTeacherIds,
              }
            : item
        )
      );

      setAssignmentDrafts((prev) => ({
        ...prev,
        [child.id]: toTeacherSlots(nextTeacherIds),
      }));

      setActionMessage({
        type: "success",
        text: `Đã cập nhật phân quyền giáo viên cho bé ${child.name}.`,
      });
    } catch (error) {
      console.error("Error updating child teacher assignments:", error);
      setActionMessage({
        type: "error",
        text: `Cập nhật thất bại cho bé ${child.name}. Không có thay đổi nào được commit.`,
      });
    } finally {
      setSavingChildId(null);
    }
  };

  const handleCreateChild = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionMessage(null);

    const childName = createChildName.trim();
    const dobIso = parseDobDdMmYyyy(createChildDob);
    const selectedTeacherIds = normalizeTeacherIds(createTeacherSlots);

    if (!childName) {
      setActionMessage({ type: "error", text: "Vui lòng nhập tên bé." });
      return;
    }

    if (!dobIso) {
      setActionMessage({
        type: "error",
        text: "Ngày sinh bắt buộc theo định dạng dd/mm/yyyy.",
      });
      return;
    }

    if (selectedTeacherIds.length === 0) {
      setActionMessage({ type: "error", text: "Vui lòng chọn tối thiểu 1 giáo viên." });
      return;
    }

    const unknownTeachers = selectedTeacherIds.filter((teacherId) => !teacherMap.has(teacherId));
    if (unknownTeachers.length > 0) {
      setActionMessage({
        type: "error",
        text: `Không tìm thấy tài khoản GV: ${unknownTeachers.join(", ")}.`,
      });
      return;
    }

    setCreateLoading(true);

    try {
      const primaryTeacherId = selectedTeacherIds[0];
      const primaryTeacherSnap = await getDoc(doc(db, "users", primaryTeacherId));
      if (!primaryTeacherSnap.exists()) {
        setActionMessage({
          type: "error",
          text: `Không tìm thấy giáo viên ${primaryTeacherId}.`,
        });
        setCreateLoading(false);
        return;
      }

      const primaryTeacherData = primaryTeacherSnap.data() as Record<string, unknown>;
      const inferredCenter =
        (typeof primaryTeacherData.centerCode === "string" && primaryTeacherData.centerCode.trim()) ||
        inferCenterFromId(primaryTeacherId) ||
        "KBC-HCM";
      const centerCode = normalizeToken(inferredCenter);

      const baseChildId = buildChildId(centerCode, childName, dobIso);
      let childId = baseChildId;
      let foundAvailableId = false;

      for (let attempt = 0; attempt <= 20; attempt += 1) {
        if (attempt > 0) {
          childId = `${baseChildId}-${attempt}`;
        }

        const childSnap = await getDoc(doc(db, "children", childId));
        if (!childSnap.exists()) {
          foundAvailableId = true;
          break;
        }
      }

      if (!foundAvailableId) {
        setActionMessage({
          type: "error",
          text: "Không thể tạo ID bé mới sau 20 lần thử. Vui lòng đổi tên bé hoặc ngày sinh.",
        });
        setCreateLoading(false);
        return;
      }

      const parentId = `PH_${childId}`;
      const parentPassword = generatePassword(8);
      const nickname = deriveChildAlias(childName);
      const secondaryTeacherIds = selectedTeacherIds.slice(1);

      const childPayload: Record<string, unknown> = {
        id: childId,
        name: childName,
        nickname,
        birthday: dobIso,
        birthDay: dobIso,
        gender: createChildGender,
        status: "Bình thường",
        hpdt: 60,
        schoolCode: centerCode,
        teacherId: primaryTeacherId,
        teacherIds: selectedTeacherIds,
        secondaryTeacherIds,
        parentId,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      if (secondaryTeacherIds[0]) {
        childPayload.secondaryTeacherId = secondaryTeacherIds[0];
      }

      const batch = writeBatch(db);
      batch.set(doc(db, "children", childId), childPayload, { merge: true });

      batch.set(
        doc(db, "users", parentId),
        {
          displayName: `Phụ huynh ${childName}`,
          role: "parent",
          childId,
          teacherId: primaryTeacherId,
          teacherIds: selectedTeacherIds,
          centerCode,
          password: parentPassword,
          accountStatus: "active",
          active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      selectedTeacherIds.forEach((teacherId) => {
        batch.set(
          doc(db, "users", teacherId),
          {
            childIds: arrayUnion(childId),
            centerCode,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      batch.set(
        doc(db, "hpdt_stats", childId),
        {
          childId,
          overallScore: 60,
          dimensions: {
            communication: 60,
            social: 60,
            behavior: 60,
            sensory: 60,
            sensor: 0,
          },
          lastUpdate: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();

      setCreateChildName("");
      setCreateChildDob("");
      setCreateChildGender("B");
      setCreateTeacherSlots(EMPTY_TEACHER_SLOTS);

      setActionMessage({
        type: "success",
        text: `Tạo bé thành công: ${childId} | Parent: ${parentId} | Pass PH: ${parentPassword}`,
      });

      await fetchPageData(true);
    } catch (error) {
      console.error("Error creating child account:", error);
      setActionMessage({
        type: "error",
        text: "Tạo account bé thất bại. Không có thay đổi nào được commit.",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" />
            Quản lý Em bé & Phân quyền giáo viên
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Trang riêng để tạo account bé và cấu hình tối đa 3 giáo viên phụ trách mỗi bé.
          </p>
        </div>
        <button
          onClick={() => void fetchPageData(true)}
          disabled={refreshing || loading}
          className="px-6 py-3.5 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-gray-300/40 hover:scale-105 transition-all disabled:opacity-60"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Đang tải" : "Làm mới"}
        </button>
      </div>

      <form onSubmit={handleCreateChild} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
        <div className="flex items-center gap-2">
          <Baby className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-black text-gray-900">Thêm account bé mới</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">Tên bé *</span>
            <input
              value={createChildName}
              onChange={(e) => setCreateChildName(e.target.value)}
              placeholder="Trương Thanh Lâm"
              className="w-full h-12 px-4 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">Ngày sinh (dd/mm/yyyy) *</span>
            <input
              value={createChildDob}
              onChange={(e) => setCreateChildDob(e.target.value)}
              placeholder="14/10/2020"
              className="w-full h-12 px-4 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">Giới tính</span>
            <select
              value={createChildGender}
              onChange={(e) => setCreateChildGender(e.target.value as "B" | "G")}
              className="w-full h-12 px-4 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700"
            >
              <option value="B">B</option>
              <option value="G">G</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">Giáo viên 1 (chính) *</span>
            <select
              value={createTeacherSlots[0]}
              onChange={(e) => handleCreateTeacherSlotChange(0, e.target.value)}
              className="w-full h-12 px-4 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700"
              required
            >
              <option value="">Chọn giáo viên</option>
              {teachers.map((teacher) => (
                <option key={`create-1-${teacher.id}`} value={teacher.id}>
                  {teacher.displayName} ({teacher.id})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">Giáo viên 2</span>
            <select
              value={createTeacherSlots[1]}
              onChange={(e) => handleCreateTeacherSlotChange(1, e.target.value)}
              className="w-full h-12 px-4 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700"
            >
              <option value="">Không gán</option>
              {teachers.map((teacher) => (
                <option key={`create-2-${teacher.id}`} value={teacher.id}>
                  {teacher.displayName} ({teacher.id})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">Giáo viên 3</span>
            <select
              value={createTeacherSlots[2]}
              onChange={(e) => handleCreateTeacherSlotChange(2, e.target.value)}
              className="w-full h-12 px-4 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700"
            >
              <option value="">Không gán</option>
              {teachers.map((teacher) => (
                <option key={`create-3-${teacher.id}`} value={teacher.id}>
                  {teacher.displayName} ({teacher.id})
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs font-semibold text-gray-500">
          Sau khi tạo, hệ thống sẽ sinh: children + parent user + hpdt_stats và tự cập nhật childIds cho giáo viên được gán.
        </p>

        <button
          type="submit"
          disabled={createLoading}
          className="h-11 px-5 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {createLoading ? "Đang tạo" : "Tạo account bé"}
          {!createLoading && <CheckCircle2 className="w-4 h-4" />}
        </button>
      </form>

      {actionMessage ? (
        <div
          className={`rounded-2xl border px-5 py-4 text-sm font-bold ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {actionMessage.text}
        </div>
      ) : null}

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[280px] relative">
          <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm bé theo ID, tên, parent hoặc center..."
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold text-gray-700 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead>
              <tr className="bg-gray-50/60">
                <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Em bé</th>
                <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Parent</th>
                <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">GV 1</th>
                <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">GV 2</th>
                <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">GV 3</th>
                <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array(6)
                  .fill(0)
                  .map((_, index) => (
                    <tr key={`loading-${index}`} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-6">
                        <div className="h-10 bg-gray-50 rounded-2xl w-full" />
                      </td>
                    </tr>
                  ))
              ) : filteredChildren.length > 0 ? (
                filteredChildren.map((child) => {
                  const draft = assignmentDrafts[child.id] || toTeacherSlots(child.teacherIds);
                  const isDirty = !isSameAssignments(child.teacherIds, draft);
                  const isSaving = savingChildId === child.id;

                  return (
                    <tr key={child.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-6 py-5 align-top">
                        <p className="text-sm font-black text-gray-900 leading-tight">{child.name}</p>
                        <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">{child.id}</p>
                        <p className="text-[11px] font-semibold text-gray-500 mt-1">
                          {child.nickname ? `Tên ở nhà: ${child.nickname}` : "Tên ở nhà: -"}
                        </p>
                        <p className="text-[11px] font-semibold text-gray-500">
                          {child.birthday ? `Ngày sinh: ${child.birthday}` : "Ngày sinh: -"}
                        </p>
                        <p className="text-[11px] font-semibold text-gray-500">
                          Center: {child.schoolCode || "-"} | HPDT: {child.hpdt} | {child.status}
                        </p>
                      </td>

                      <td className="px-6 py-5 align-top">
                        <p className="text-sm font-black text-gray-800">{child.parentId || "-"}</p>
                      </td>

                      {[0, 1, 2].map((slotIndex) => (
                        <td key={`${child.id}-slot-${slotIndex}`} className="px-6 py-5 align-top">
                          <select
                            value={draft[slotIndex as 0 | 1 | 2]}
                            onChange={(e) => handleDraftChange(child.id, slotIndex as 0 | 1 | 2, e.target.value)}
                            className="w-full h-11 px-3 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700"
                          >
                            <option value="">{slotIndex === 0 ? "Chọn GV chính" : "Không gán"}</option>
                            {teacherOptions.map((teacher) => (
                              <option key={`${child.id}-${slotIndex}-${teacher.id}`} value={teacher.id}>
                                {teacher.displayName} ({teacher.id})
                                {teacher.accountStatus === "inactive" ? " - inactive" : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}

                      <td className="px-6 py-5 align-top text-right">
                        <div className="inline-flex flex-col items-end gap-2">
                          <button
                            onClick={() => void handleSaveTeachers(child)}
                            disabled={isSaving || !draft[0]}
                            className="px-4 h-10 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-60"
                          >
                            <Save className="w-4 h-4" />
                            {isSaving ? "Đang lưu" : "Lưu"}
                          </button>
                          {isDirty ? (
                            <span className="text-[10px] font-black text-amber-600">Chưa lưu thay đổi</span>
                          ) : (
                            <span className="text-[10px] font-black text-emerald-600">Đã đồng bộ</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-gray-200" />
                      <p className="text-gray-400 font-bold">Không tìm thấy hồ sơ bé.</p>
                    </div>
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
