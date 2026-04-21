"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Camera, Loader2, Save, Sparkles } from "lucide-react";
import { db } from "@/lib/firebase";
import { getAuthSession } from "@/lib/auth-session";
import { resolveLearnerForParent } from "@/lib/services/learnerService";

type ParentGender = "male" | "female" | "other";
type ChildGender = "B" | "G";

interface ParentFormState {
  displayName: string;
  birthday: string;
  gender: ParentGender;
  email: string;
  phone: string;
}

interface ChildFormState {
  name: string;
  birthday: string;
  nickname: string;
  gender: ChildGender;
  centerId: string;
  notes: string;
  hpdt: number;
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
    return "";
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate?: () => Date }).toDate?.();
    if (d && !Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }

  return "";
}

function toDisplayDate(value: string): string {
  if (!value) return "Chưa cập nhật";
  const [yyyy, mm, dd] = value.split("-");
  if (!yyyy || !mm || !dd) return "Chưa cập nhật";
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeParentGender(value: unknown): ParentGender {
  const raw = String(value || "").toLowerCase();
  if (raw === "male" || raw === "m" || raw === "nam" || raw === "b") return "male";
  if (raw === "female" || raw === "f" || raw === "nu" || raw === "nữ" || raw === "g") return "female";
  return "other";
}

function normalizeChildGender(value: unknown): ChildGender {
  const raw = String(value || "").toUpperCase();
  return raw === "G" ? "G" : "B";
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
  if (!ctx) {
    throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function ParentProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState("");
  const [childId, setChildId] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");

  const [parentForm, setParentForm] = useState<ParentFormState>({
    displayName: "",
    birthday: "",
    gender: "other",
    email: "",
    phone: "",
  });

  const [childForm, setChildForm] = useState<ChildFormState>({
    name: "",
    birthday: "",
    nickname: "",
    gender: "B",
    centerId: "",
    notes: "",
    hpdt: 0,
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

        setParentForm({
          displayName: String(userData.displayName || userData.name || ""),
          birthday: toInputDate(userData.birthday),
          gender: normalizeParentGender(userData.gender),
          email: String(userData.email || ""),
          phone: String(userData.phone || ""),
        });

        const learner = await resolveLearnerForParent(
          session.userId,
          typeof userData.childId === "string" ? userData.childId : undefined
        );

        if (learner) {
          const learnerData = learner as Record<string, unknown>;
          setChildId(learner.id);
          setChildForm({
            name: String(learnerData.name || ""),
            birthday: toInputDate(learnerData.birthday),
            nickname: String(learnerData.nickname || ""),
            gender: normalizeChildGender(learnerData.gender),
            centerId: String(learnerData.schoolCode || userData.centerCode || ""),
            notes: String(learnerData.notes || learnerData.description || ""),
            hpdt: typeof learnerData.hpdt === "number" ? learnerData.hpdt : 0,
          });

          const existingAvatar = String(
            learnerData.avatarDataUrl || learnerData.avatarUrl || userData.childAvatarDataUrl || ""
          );
          if (existingAvatar) {
            setAvatarDataUrl(existingAvatar);
          }
        }
      } catch (error) {
        console.error("[parent-profile] load error", error);
        setMessage("Không tải được hồ sơ. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const hpdtLabel = useMemo(() => {
    if (childForm.hpdt >= 70) return "Đang tiến bộ tốt";
    if (childForm.hpdt >= 40) return "Đang cải thiện";
    return "Cần thêm hỗ trợ";
  }, [childForm.hpdt]);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Vui lòng chọn file ảnh hợp lệ.");
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
      setMessage("Vui lòng cập nhật avatar của bé trước khi lưu.");
      return;
    }

    if (!parentForm.displayName.trim() || !parentForm.email.trim()) {
      setMessage("Vui lòng nhập đầy đủ tên phụ huynh và email.");
      return;
    }

    if (!childId || !childForm.name.trim() || !childForm.birthday || !childForm.centerId.trim()) {
      setMessage("Vui lòng nhập đầy đủ tên bé, ngày sinh và centerID.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const userPayload: Record<string, unknown> = {
        displayName: parentForm.displayName.trim(),
        email: parentForm.email.trim(),
        birthday: parentForm.birthday,
        gender: parentForm.gender,
        phone: parentForm.phone.trim(),
        centerCode: childForm.centerId.trim(),
        childId,
        childAvatarDataUrl: avatarDataUrl,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", userId), userPayload, { merge: true });

      const childPayload: Record<string, unknown> = {
        name: childForm.name.trim(),
        birthday: childForm.birthday,
        nickname: childForm.nickname.trim(),
        gender: childForm.gender,
        schoolCode: childForm.centerId.trim(),
        notes: childForm.notes.trim(),
        avatarDataUrl,
        hpdt: childForm.hpdt,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "children", childId), childPayload, { merge: true });
      setMessage("Đã lưu thông tin phụ huynh và hồ sơ bé thành công.");
    } catch (error) {
      console.error("[parent-profile] save error", error);
      setMessage("Lưu hồ sơ thất bại. Vui lòng thử lại.");
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
        <h1 className="text-2xl md:text-3xl font-black text-gray-900">Thông tin cá nhân</h1>
        <p className="text-sm font-semibold text-gray-500 mt-1">Phụ huynh cập nhật hồ sơ và avatar của bé. Avatar được lưu trực tiếp trong cơ sở dữ liệu.</p>
      </div>

      <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-soft space-y-6">
        <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-primary">Avatar 3D + hpdt của trẻ</p>
            <h2 className="text-xl font-black text-gray-900">{childForm.name || "Chưa có tên bé"}</h2>
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-wide cursor-pointer hover:bg-indigo-100">
            <Camera className="w-4 h-4" />
            {avatarUploading ? "Đang xử lý" : "Đổi avatar"}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>

        <div className="relative rounded-[30px] bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-5 text-white shadow-lg">
          <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase">
            <Sparkles className="w-3 h-3" />
            hpdt {childForm.hpdt}%
          </div>

          <div className="w-32 h-32 rounded-[28px] overflow-hidden border-4 border-white/30 bg-white/15 shadow-xl backdrop-blur-sm">
            {avatarDataUrl ? (
              <Image src={avatarDataUrl} alt="Avatar bé" width={256} height={256} className="w-full h-full object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-black">
                {(childForm.name || "B").charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="text-sm font-bold">{hpdtLabel}</p>
            <p className="text-xs text-white/80 mt-1">Ngày sinh bé: {toDisplayDate(childForm.birthday)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-soft space-y-4">
        <h3 className="text-lg font-black text-gray-900">Thông tin phụ huynh</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Tên phụ huynh</span>
            <input
              value={parentForm.displayName}
              onChange={(e) => setParentForm((prev) => ({ ...prev, displayName: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="Nhập tên phụ huynh"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Ngày sinh</span>
            <input
              type="date"
              value={parentForm.birthday}
              onChange={(e) => setParentForm((prev) => ({ ...prev, birthday: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Giới tính</span>
            <select
              value={parentForm.gender}
              onChange={(e) => setParentForm((prev) => ({ ...prev, gender: e.target.value as ParentGender }))}
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
              value={parentForm.email}
              onChange={(e) => setParentForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="example@email.com"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Số điện thoại (optional)</span>
            <input
              value={parentForm.phone}
              onChange={(e) => setParentForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="Có thể để trống"
            />
          </label>
        </div>

        <div className="h-px bg-gray-100 my-2" />

        <h3 className="text-lg font-black text-gray-900">Thông tin của bé</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Tên bé</span>
            <input
              value={childForm.name}
              onChange={(e) => setChildForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="Tên bé"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Ngày sinh bé</span>
            <input
              type="date"
              value={childForm.birthday}
              onChange={(e) => setChildForm((prev) => ({ ...prev, birthday: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
            />
            <p className="text-[11px] font-semibold text-gray-400">Hiển thị: {toDisplayDate(childForm.birthday)} (dd/mm/yyyy)</p>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Biệt danh</span>
            <input
              value={childForm.nickname}
              onChange={(e) => setChildForm((prev) => ({ ...prev, nickname: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="Biệt danh ở nhà"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Giới tính bé</span>
            <select
              value={childForm.gender}
              onChange={(e) => setChildForm((prev) => ({ ...prev, gender: e.target.value as ChildGender }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
            >
              <option value="B">Bé trai (B)</option>
              <option value="G">Bé gái (G)</option>
            </select>
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Trung tâm can thiệp (centerID)</span>
            <input
              value={childForm.centerId}
              onChange={(e) => setChildForm((prev) => ({ ...prev, centerId: e.target.value }))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700"
              placeholder="Ví dụ: KBC-HCM"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-wide text-gray-500">Ghi chú khác về bé</span>
            <textarea
              rows={4}
              value={childForm.notes}
              onChange={(e) => setChildForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700"
              placeholder="Ví dụ: sở thích, lưu ý cảm giác, thói quen cần theo dõi..."
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
