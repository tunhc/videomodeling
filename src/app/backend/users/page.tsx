"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Users, UserPlus, Trash2, Search, Filter, Shield, 
  Mail, Key, User, CheckCircle2, XCircle, AlertCircle, X
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  password?: string;
  updatedAt?: any;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Create User State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newPassword, setNewPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId || !newName || !newEmail || !newPassword) {
      alert("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    setFormLoading(true);
    try {
      const userData = {
        displayName: newName,
        email: newEmail,
        role: newRole,
        password: newPassword,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "users", newUserId), userData);
      
      setIsModalOpen(false);
      // Reset form
      setNewUserId("");
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      
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
      return matchSearch && matchRole;
    });
  }, [users, searchQuery, roleFilter]);

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
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Tài khoản (ID)</th>
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Vai trò</th>
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Email / Liên hệ</th>
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Mật khẩu</th>
                <th className="px-8 py-6 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                 Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                       <td colSpan={5} className="px-8 py-6"><div className="h-6 bg-gray-50 rounded-lg w-full" /></td>
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
                      <div className="flex items-center gap-2 text-gray-500 font-medium text-sm">
                        <Mail className="w-4 h-4 text-gray-300" />
                        {user.email || "—"}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                          <Key className="w-3.5 h-3.5" />
                          <span className="group-hover:text-gray-800 transition-colors">{user.password}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Xóa tài khoản"
                       >
                          <Trash2 className="w-5 h-5" />
                       </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center">
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
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">ID Tài khoản (Dùng để đăng nhập)</label>
                    <input 
                      type="text" 
                      placeholder="VD: GV_KBC_AN" 
                      className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                      value={newUserId}
                      onChange={e => setNewUserId(e.target.value)}
                      required
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Họ và Tên</label>
                        <input 
                          type="text" 
                          placeholder="Nguyễn Văn A" 
                          className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Vai trò</label>
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
