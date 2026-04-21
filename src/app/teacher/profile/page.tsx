"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Camera, Clapperboard, Loader2, Save, Sparkles } from "lucide-react";
import { db } from "@/lib/firebase";
import { getAuthSession } from "@/lib/auth-session";
import { getLearnersForTeacher } from "@/lib/services/learnerService";

type TeacherGender = "male" | "female" | "other";

interface TeacherFormState {
  displayName: string;
  birthday: string;
  gender: TeacherGender;
  email: string;
  phone: string;
  centerCode: string;
}

const MAX_AVATAR_DATA_URL_LENGTH = 750000;

function toInputDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate?: () => Date }).toDate?.();
    if (d && !Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }

  return "";
}

function normalizeGender(value: unknown): TeacherGender {
  const raw = String(value || "").toLowerCase();
  if (raw === "male" || raw === "m" || raw === "nam" || raw === "b") return "male";
  if (raw === "female" || raw === "f" || raw === "nu" || raw === "nữ" || raw === "g") return "female";
  return "other";
}

async function compressAvatar(file: File): Promise<string> {
  const sourceDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Không đọc được file ảnh."));
      }
    };
    reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Ảnh không hợp lệ."));
    img.src = sourceDataUrl;
  });

  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function TeacherProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");

  const [form, setForm] = useState<TeacherFormState>({
    displayName: "",
    birthday: "",
    gender: "other",
    email: "",
    phone: "",
    centerCode: "",
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const session = getAuthSession();
        if (!session?.userId) {
          setMessage("Không tìm thấy phiên đăng nhập.");
          return;
        }

        setUserId(session.userId);

        const userSnap = await getDoc(doc(db, "users", session.userId));
        const userData = userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : {};

        let defaultCenter = String(userData.centerCode || userData.schoolCode || "");

        if (!defaultCenter) {
          const learners = await getLearnersForTeacher(session.userId, "teacher");
          const schoolCenter = learners.find((item) => typeof item.schoolCode === "string" && item.schoolCode.trim());
          if (schoolCenter?.schoolCode) {
            defaultCenter = schoolCenter.schoolCode;
          }
        }

        setForm({
          displayName: String(userData.displayName || userData.name || session.userName || session.userId),
          birthday: toInputDate(userData.birthday),
          gender: normalizeGender(userData.gender),
          email: String(userData.email || ""),
          phone: String(userData.phone || ""),
          centerCode: defaultCenter,
        });

        const existingAvatar = String(userData.avatarDataUrl || userData.avatarUrl || "");
        if (existingAvatar) {
          setAvatarDataUrl(existingAvatar);
        }
      } catch (error) {
        console.error("[teacher-profile] load error", error);
        setMessage("Không tải được hồ sơ giáo viên.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const profileTag = useMemo(() => {
    if (form.centerCode) return `Center ${form.centerCode}`;
    return "Video Modeling Teacher";
  }, [form.centerCode]);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Vui lòng chọn ảnh hợp lệ.");
      return;
    }

    setAvatarUploading(true);
    setMessage("");
    try {
      const compressed = await compressAvatar(file);
      if (compressed.length > MAX_AVATAR_DATA_URL_LENGTH) {
        throw new Error("Ảnh quá lớn sau khi nén, vui lòng chọn ảnh khác.");
      }
      setAvatarDataUrl(compressed);
    } catch (error) {
      const err = error instanceof Error ? error.message : "Không thể xử lý ảnh.";
      setMessage(err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!userId) {
      setMessage("Không tìm thấy tài khoản đăng nhập.");
      return;
    }

    if (!avatarDataUrl) {
      setMessage("Vui lòng cập nhật avatar giáo viên trước khi lưu.");
      return;
    }

    if (!form.displayName.trim() || !form.email.trim() || !form.centerCode.trim()) {
      setMessage("Vui lòng nhập tên, email và trung tâm.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const payload: Record<string, unknown> = {
        displayName: form.displayName.trim(),
        birthday: form.birthday,
        gender: form.gender,
        email: form.email.trim(),
        phone: form.phone.trim(),
        centerCode: form.centerCode.trim(),
        avatarDataUrl,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", userId), payload, { merge: true });
      setMessage("Đã lưu thông tin giáo viên thành công.");
    } catch (error) {
      console.error("[teacher-profile] save error", error);
      setMessage("Lưu thông tin thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-calming-bg">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 pb-28 bg-calming-bg min-h-screen space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900">Thông tin cá nhân giáo viên</h1>
        <p className="text-sm font-semibold text-gray-500 mt-1">Avatar và thông tin giáo viên được lưu trong cơ sở dữ liệu để dùng cho luồng Video Modeling.</p>
      </div>

      <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-soft space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-indigo-600">Avatar giáo viên</p>
            <h2 className="text-xl font-black text-gray-900">{form.displayName || "Chưa có tên giáo viên"}</h2>
            <p className="text-xs font-semibold text-gray-500 mt-1">{profileTag}</p>
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-wide cursor-pointer hover:bg-indigo-100">
            <Camera className="w-4 h-4" />
            {avatarUploading ? "Đang xử lý" : "Đổi avatar"}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>

        <div className="rounded-[30px] bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 p-5 text-white relative overflow-hidden">
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase">
            <Sparkles className="w-3 h-3" />
            video modeling
          </div>

          <div className="w-28 h-28 rounded-[26px] overflow-hidden border-4 border-white/25 bg-white/15 shadow-lg">
            {avatarDataUrl ? (
              <Image src={avatarDataUrl} alt="Avatar giáo viên" width={240} height={240} className="w-full h-full object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-black">
                {(form.displayName || "T").charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide">
            <Clapperboard className="w-4 h-4" />
            Hồ sơ giảng dạy cá nhân
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-soft space-y-4">
        <h3 className="text-lg font-black text-gray-900">Thông tin giáo viên</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Tên giáo viên</span>
            <input
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="Nhập tên giáo viên"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Ngày tháng năm sinh</span>
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setForm((prev) => ({ ...prev, birthday: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Giới tính</span>
            <select
              value={form.gender}
              onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value as TeacherGender }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
            >
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="teacher@email.com"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Số điện thoại</span>
            <input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="Nhập số điện thoại"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Thuộc trung tâm (centerID)</span>
            <input
              value={form.centerCode}
              onChange={(e) => setForm((prev) => ({ ...prev, centerCode: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="Mặc định lấy từ school"
            />
          </label>
        </div>

        {message ? <p className="text-sm font-bold text-indigo-600">{message}</p> : null}

        <button
          onClick={() => void saveProfile()}
          disabled={saving || avatarUploading}
          className="w-full h-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-xs disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Đang lưu" : "Lưu thông tin"}
        </button>
      </div>
    </div>
  );
}
