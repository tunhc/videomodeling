"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDoc, getDocs, deleteDoc, doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  UserPlus, Trash2, Search, Shield,
  Mail, Key, CheckCircle2, AlertCircle, X, RefreshCw, Power
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  password?: string;
  centerCode?: string;
  childId?: string;
  accountStatus: "active" | "inactive";
  updatedAt?: unknown;
}

const ROLE_PREFIX: Record<string, string> = {
  admin: "AD",
  professor: "CG",
  projectmanager: "PM",
  teacher: "GV",
  parent: "PH",
};

function randomToken(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

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

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [centerFilter, setCenterFilter] = useState("all");

  // Create User State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newPassword, setNewPassword] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newCenterCode, setNewCenterCode] = useState("KBC-HCM");
  const [newGender, setNewGender] = useState<"B" | "G">("B");
  const [newRandomToken, setNewRandomToken] = useState(randomToken());
  const [newAccountStatus, setNewAccountStatus] = useState<"active" | "inactive">("active");
  const [formLoading, setFormLoading] = useState(false);

  const generatedUserId = useMemo(() => {
    const prefix = ROLE_PREFIX[newRole] || "US";
    const center = normalizeToken(newCenterCode || "CENTER");
    const child = normalizeToken(newChildName || "CHILD");
    return `${prefix}_${center}_${child}-${newGender}${newRandomToken}`;
  }, [newRole, newCenterCode, newChildName, newGender, newRandomToken]);

  const centerOptions = useMemo(() => {
    const options = new Set<string>();
    users.forEach((user) => {
      const center = user.centerCode || inferCenterFromId(user.id);
      if (center) options.add(center);
    });
    return Array.from(options).sort();
  }, [users]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "users"));
      const list: UserItem[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.displayName || data.name || doc.id,
          email: data.email || "",
          role: data.role || "unknown",
          password: data.password || "",
          centerCode: data.centerCode || data.centerId || inferCenterFromId(doc.id),
          childId: data.childId || "",
          accountStatus: data.accountStatus === "inactive" || data.active === false ? "inactive" : "active",
          updatedAt: data.updatedAt
        });
      });
      setUsers(list.sort((a, b) => a.id.localeCompare(b.id)));
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản ${id}?`)) return;

    try {
      await deleteDoc(doc(db, "users", id));
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Lỗi khi xóa tài khoản.");
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    const nextStatus = user.accountStatus === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "users", user.id), {
        accountStatus: nextStatus,
        active: nextStatus === "active",
        updatedAt: serverTimestamp(),
      });

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, accountStatus: nextStatus, updatedAt: new Date() }
            : item
        )
      );
    } catch (err) {
      console.error("Error updating user status:", err);
      alert("Không thể cập nhật trạng thái tài khoản.");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword || !newChildName || !newCenterCode) {
      alert("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    setFormLoading(true);
    try {
      const docRef = doc(db, "users", generatedUserId);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        alert("ID tài khoản đã tồn tại. Vui lòng đổi child/gender hoặc random.");
        setFormLoading(false);
        return;
      }

      const userData = {
        displayName: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        password: newPassword,
        centerCode: normalizeToken(newCenterCode),
        childAlias: normalizeToken(newChildName),
        gender: newGender,
        accountStatus: newAccountStatus,
        active: newAccountStatus === "active",
        updatedAt: serverTimestamp()
      };

      await setDoc(docRef, userData);
      
      setIsModalOpen(false);
      // Reset form
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewChildName("");
      setNewGender("B");
      setNewCenterCode("KBC-HCM");
      setNewRandomToken(randomToken());
      setNewAccountStatus("active");
      
      fetchUsers(); // Refresh
    } catch (err) {
      console.error("Error creating user:", err);
      alert("Lỗi khi tạo tài khoản. ID có thể đã tồn tại.");
    } finally {
      setFormLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || u.accountStatus === statusFilter;
      const userCenter = (u.centerCode || inferCenterFromId(u.id) || "").toLowerCase();
      const matchCenter = centerFilter === "all" || userCenter === centerFilter.toLowerCase();
      return matchSearch && matchRole && matchStatus && matchCenter;
    });
  }, [users, searchQuery, roleFilter, statusFilter, centerFilter]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            Quản trị Người dùng
          </h1>
          <p className="text-gray-500 font-medium mt-1">Quản lý danh sách tài khoản chuyên gia, giáo viên và phụ huynh.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-blue-500/30 hover:scale-105 transition-all outline-none"
        >
          <UserPlus className="w-5 h-5" />
          Tạo tài khoản mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm theo ID, Tên hoặc Email..." 
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-700 transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          <button 
            onClick={() => setRoleFilter("all")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${roleFilter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
          >
            Tất cả
          </button>
          <button 
            onClick={() => setRoleFilter("admin")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${roleFilter === 'admin' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
          >
            Admin
          </button>
          <button 
            onClick={() => setRoleFilter("professor")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${roleFilter === 'professor' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
          >
            Chuyên gia
          </button>
          <button 
            onClick={() => setRoleFilter("teacher")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${roleFilter === 'teacher' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
          >
            Giáo viên
          </button>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${statusFilter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
          >
            Mọi trạng thái
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${statusFilter === 'active' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-400'}`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${statusFilter === 'inactive' ? 'bg-white shadow-sm text-rose-600' : 'text-gray-400'}`}
          >
            Inactive
          </button>
        </div>

        <div className="min-w-[190px]">
          <select
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value)}
            className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-bold text-gray-700"
          >
            <option value="all">Tất cả CenterID</option>
            {centerOptions.map((center) => (
              <option key={center} value={center}>
                {center}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Tài khoản (ID)</th>
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Vai trò</th>
                 <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">CenterID</th>
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Email / Liên hệ</th>
                 <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Trạng thái</th>
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Mật khẩu</th>
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                 Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-8 py-6"><div className="h-6 bg-gray-50 rounded-lg w-full" /></td>
                    </tr>
                 ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-gray-400 group-hover:text-blue-600 font-black">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-800 tracking-tight">{user.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                        user.role === 'admin' ? 'bg-red-100 text-red-600' :
                        user.role === 'professor' ? 'bg-indigo-100 text-indigo-600' :
                        user.role === 'projectmanager' ? 'bg-blue-100 text-blue-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-bold text-gray-700">{user.centerCode || inferCenterFromId(user.id) || "—"}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-gray-500 font-medium text-sm">
                        <Mail className="w-4 h-4 text-gray-300" />
                        {user.email || "—"}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border transition-colors ${
                          user.accountStatus === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        }`}
                        title="Bật/tắt trạng thái tài khoản"
                      >
                        <Power className="w-3 h-3" />
                        {user.accountStatus}
                      </button>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                          <Key className="w-3.5 h-3.5" />
                          <span className="group-hover:text-gray-800 transition-colors">{user.password ? "•".repeat(Math.min(10, user.password.length)) : "—"}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className="p-2.5 text-gray-300 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          title="Đổi active/inactive"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Xóa tài khoản"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                   <td colSpan={7} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                         <AlertCircle className="w-8 h-8 text-gray-200" />
                         <p className="text-gray-400 font-bold">Không tìm thấy tài khoản nào.</p>
                      </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
           <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                 <h2 className="text-xl font-black text-gray-900">Tạo tài khoản mới</h2>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              
              <form onSubmit={handleCreateUser} className="p-8 space-y-6">
                 <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Child Name</label>
                    <input
                      type="text"
                      placeholder="VD: Khang"
                      className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                      value={newChildName}
                      onChange={e => setNewChildName(e.target.value)}
                      required
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Role</label>
                        <select 
                          className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 appearance-none"
                          value={newRole}
                          onChange={e => setNewRole(e.target.value)}
                        >
                           <option value="admin">Admin</option>
                           <option value="professor">Chuyên gia</option>
                           <option value="projectmanager">Manager</option>
                           <option value="teacher">Giáo viên</option>
                           <option value="parent">Phụ huynh</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">CenterID</label>
                        <input
                          type="text"
                          placeholder="VD: KBC-HCM"
                          className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                          value={newCenterCode}
                          onChange={(e) => setNewCenterCode(e.target.value)}
                          required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gender</label>
                        <select
                          className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 appearance-none"
                          value={newGender}
                          onChange={(e) => setNewGender(e.target.value as "B" | "G")}
                        >
                          <option value="B">B</option>
                          <option value="G">G</option>
                        </select>
                    </div>
                 </div>

                 <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Account ID tự sinh</p>
                        <p className="text-sm font-black text-gray-800 mt-1 break-all">{generatedUserId}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewRandomToken(randomToken())}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-xs font-black text-gray-600 hover:bg-white"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Random
                      </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Họ và tên</label>
                      <input
                        type="text"
                        placeholder="Nguyễn Văn A"
                        className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Trạng thái</label>
                      <select
                        value={newAccountStatus}
                        onChange={(e) => setNewAccountStatus(e.target.value as "active" | "inactive")}
                        className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 appearance-none"
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Email</label>
                    <input 
                      type="email" 
                      placeholder="example@gmail.com" 
                      className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      required
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Mật khẩu</label>
                    <input 
                      type="text" 
                      placeholder="Mật khẩu khởi tạo" 
                      className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                    />
                 </div>

                 <button 
                  type="submit" 
                  disabled={formLoading}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-sm shadow-xl shadow-gray-200 hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                 >
                    {formLoading ? "Đang xử lý..." : "Xác nhận tạo tài khoản"}
                    {!formLoading && <CheckCircle2 className="w-5 h-5" />}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
