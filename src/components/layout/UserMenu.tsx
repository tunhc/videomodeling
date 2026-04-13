"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, Settings, ChevronDown, Lock, Loader2, X } from "lucide-react";
import { clearAuthSession, getAuthSession } from "@/lib/auth-session";
import { changeUserPassword } from "@/lib/services/authService";

interface UserMenuProps {
  userName: string;
  role: string;
  avatarInitial?: string;
}

export default function UserMenu({ userName, role, avatarInitial }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!portalRoot) return;
    const originalOverflow = document.body.style.overflow;
    if (isPasswordModalOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isPasswordModalOpen, portalRoot]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  const openPasswordModal = () => {
    setIsOpen(false);
    setPasswordError("");
    setPasswordSuccess("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (changingPassword) return;
    setIsPasswordModalOpen(false);
  };

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    const isAdminRole = role === "admin";

    if (!newPassword || !confirmPassword) {
      setPasswordError("Vui lòng nhập đủ thông tin mật khẩu mới");
      return;
    }

    if (isAdminRole && !currentPassword.trim()) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới cần ít nhất 6 ký tự");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp");
      return;
    }

    const session = getAuthSession();
    if (!session?.userId) {
      setPasswordError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setChangingPassword(true);
    try {
      await changeUserPassword({
        userId: session.userId,
        currentPassword: currentPassword.trim(),
        nextPassword: newPassword,
        userRole: session.userRole,
      });
      setPasswordSuccess("Đổi mật khẩu thành công");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể đổi mật khẩu";
      setPasswordError(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const roleLabel = role === "admin" ? "Quản trị viên" : role === "teacher" ? "Giáo viên" : "Phụ huynh";

  return (
    <div className="relative">
      {/* Trigger */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 pr-4 rounded-3xl bg-white/40 hover:bg-white/60 backdrop-blur-md border border-white/50 transition-all shadow-sm"
      >
        <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black shadow-hpdt">
          {avatarInitial || userName[0]?.toUpperCase() || "U"}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-[13px] font-black text-gray-900 leading-tight">
            {userName.split(' ')[0]}
          </p>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            {roleLabel}
          </p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for closing */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-100 shadow-2xl rounded-[24px] sm:rounded-[32px] overflow-hidden z-[100] p-2 origin-top-left"
            >
              <div className="px-6 py-4 border-b border-gray-100/50 mb-2">
                <p className="text-sm font-black text-gray-900">{userName}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{roleLabel}</p>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-6 py-4 text-sm font-bold text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors group rounded-2xl"
                >
                  <div className="p-2 rounded-xl bg-gray-50 group-hover:bg-primary/10 transition-colors text-gray-400 group-hover:text-primary">
                    <User size={18} />
                  </div>
                  Thông tin cá nhân
                </button>
                <button
                  onClick={openPasswordModal}
                  className="w-full flex items-center gap-3 px-6 py-4 text-sm font-bold text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors group rounded-2xl"
                >
                  <div className="p-2 rounded-xl bg-gray-50 group-hover:bg-primary/10 transition-colors text-gray-400 group-hover:text-primary">
                    <Settings size={18} />
                  </div>
                  Cài đặt
                </button>
                <div className="h-px bg-gray-100/50 mx-4 my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-6 py-4 text-sm font-black text-red-500 hover:bg-red-50 transition-colors group rounded-2xl"
                >
                  <div className="p-2 rounded-xl bg-red-50 text-red-500">
                    <LogOut size={18} />
                  </div>
                  Đăng xuất
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {portalRoot
        ? createPortal(
            <AnimatePresence>
              {isPasswordModalOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm"
                    onClick={closePasswordModal}
                  />

                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.98 }}
                    className="fixed inset-0 z-[130] grid place-items-center p-4"
                  >
                    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-gray-100 shadow-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-black text-gray-900">Đổi mật khẩu</h3>
                          <p className="text-xs font-semibold text-gray-500">Cập nhật mật khẩu để đăng nhập thuận tiện hơn</p>
                        </div>
                        <button
                          type="button"
                          onClick={closePasswordModal}
                          className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-gray-600">Mật khẩu hiện tại {role === "admin" ? "*" : "(không bắt buộc)"}</label>
                        <div className="relative">
                          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder={role === "admin" ? "Nhập mật khẩu hiện tại" : "Có thể để trống"}
                          />
                        </div>

                        <label className="block text-xs font-bold text-gray-600">Mật khẩu mới</label>
                        <div className="relative">
                          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Ít nhất 6 ký tự"
                          />
                        </div>

                        <label className="block text-xs font-bold text-gray-600">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Nhập lại mật khẩu mới"
                          />
                        </div>
                      </div>

                      {passwordError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                          {passwordError}
                        </div>
                      ) : null}

                      {passwordSuccess ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                          {passwordSuccess}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={handlePasswordChange}
                        disabled={changingPassword}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-3 text-sm font-black disabled:opacity-60"
                      >
                        {changingPassword ? <Loader2 size={16} className="animate-spin" /> : null}
                        {changingPassword ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            portalRoot
          )
        : null}
    </div>
  );
}
