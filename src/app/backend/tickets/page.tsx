"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ClipboardList,
  Loader2,
  MessageCircleWarning,
  Save,
  Search,
} from "lucide-react";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type RaisedRole = "parent" | "teacher" | "admin" | "other";

interface TicketLogItem {
  id: string;
  issue: string;
  raisedBy: string;
  raisedByRole: RaisedRole;
  raisedAt: unknown;
  status: TicketStatus;
  solutionNote: string;
  source: "zalo";
  updatedAt?: unknown;
}

function toDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") return fn();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: unknown): string {
  const date = toDateValue(value);
  if (!date) return "Vừa ghi nhận";
  return date.toLocaleString("vi-VN");
}

function roleLabel(role: RaisedRole): string {
  if (role === "parent") return "Phụ huynh";
  if (role === "teacher") return "Giáo viên";
  if (role === "admin") return "Admin";
  return "Khác";
}

function statusStyle(status: TicketStatus): string {
  if (status === "open") return "bg-red-50 text-red-700 border-red-200";
  if (status === "in_progress") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "resolved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function nowForInput(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function BackendTicketLogsPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<TicketLogItem[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");

  const [issue, setIssue] = useState("");
  const [raisedBy, setRaisedBy] = useState("");
  const [raisedByRole, setRaisedByRole] = useState<RaisedRole>("parent");
  const [raisedAtInput, setRaisedAtInput] = useState(nowForInput());

  const [draftStatus, setDraftStatus] = useState<Record<string, TicketStatus>>({});
  const [draftSolution, setDraftSolution] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const byStatus = statusFilter === "all" || ticket.status === statusFilter;
      const bySearch =
        q.length === 0 ||
        ticket.issue.toLowerCase().includes(q) ||
        ticket.raisedBy.toLowerCase().includes(q) ||
        ticket.solutionNote.toLowerCase().includes(q);
      return byStatus && bySearch;
    });
  }, [tickets, search, statusFilter]);

  async function fetchTickets() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "ticket_logs"));
      const rows: TicketLogItem[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<TicketLogItem, "id">) }))
        .sort((a, b) => {
          const ta = toDateValue(a.raisedAt)?.getTime() || 0;
          const tb = toDateValue(b.raisedAt)?.getTime() || 0;
          return tb - ta;
        });

      setTickets(rows);
      const statusDraft: Record<string, TicketStatus> = {};
      const solutionDraft: Record<string, string> = {};
      rows.forEach((ticket) => {
        statusDraft[ticket.id] = ticket.status;
        solutionDraft[ticket.id] = ticket.solutionNote || "";
      });
      setDraftStatus(statusDraft);
      setDraftSolution(solutionDraft);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!issue.trim() || !raisedBy.trim()) {
      alert("Vui lòng nhập đầy đủ nội dung ticket và người raise.");
      return;
    }

    setSubmitting(true);
    try {
      const raisedAtDate = new Date(raisedAtInput);
      const payload = {
        id: `TL_${Date.now()}`,
        issue: issue.trim(),
        raisedBy: raisedBy.trim(),
        raisedByRole,
        raisedAt: Number.isNaN(raisedAtDate.getTime()) ? new Date() : raisedAtDate,
        status: "open" as TicketStatus,
        solutionNote: "",
        source: "zalo" as const,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(collection(db, "ticket_logs"), payload.id), payload);

      setIssue("");
      setRaisedBy("");
      setRaisedByRole("parent");
      setRaisedAtInput(nowForInput());
      await fetchTickets();
    } catch (error) {
      console.error("[ticket_logs] create error", error);
      alert("Không thể tạo ticket. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveTicket(ticketId: string) {
    const nextStatus = draftStatus[ticketId];
    const nextSolution = (draftSolution[ticketId] || "").trim();
    if (!nextStatus) return;

    setSavingId(ticketId);
    try {
      await updateDoc(doc(db, "ticket_logs", ticketId), {
        status: nextStatus,
        solutionNote: nextSolution,
        updatedAt: serverTimestamp(),
      });

      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, status: nextStatus, solutionNote: nextSolution, updatedAt: new Date() }
            : ticket
        )
      );
    } catch (error) {
      console.error("[ticket_logs] update error", error);
      alert("Lưu ticket thất bại. Vui lòng thử lại.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Ticket Logs</h1>
        <p className="text-gray-500 font-medium">
          Ghi nhận ticket vấn đề raise từ Zalo, theo dõi trạng thái xử lý và lưu solution note.
        </p>
      </div>

      <form
        onSubmit={handleCreateTicket}
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm"
      >
        <div className="lg:col-span-5">
          <label className="text-xs font-black text-gray-400 uppercase">Nội dung ticket</label>
          <textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Mô tả vấn đề nhận từ Zalo..."
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-black text-gray-400 uppercase">Người raise</label>
          <input
            value={raisedBy}
            onChange={(e) => setRaisedBy(e.target.value)}
            className="mt-2 w-full h-11 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Tên / ID"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-black text-gray-400 uppercase">Role</label>
          <select
            value={raisedByRole}
            onChange={(e) => setRaisedByRole(e.target.value as RaisedRole)}
            className="mt-2 w-full h-11 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="parent">Phụ huynh</option>
            <option value="teacher">Giáo viên</option>
            <option value="admin">Admin</option>
            <option value="other">Khác</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-black text-gray-400 uppercase">Thời gian raise</label>
          <input
            type="datetime-local"
            value={raisedAtInput}
            onChange={(e) => setRaisedAtInput(e.target.value)}
            className="mt-2 w-full h-11 rounded-2xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="lg:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Đang lưu" : "Tạo"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-black text-gray-800">Danh sách ticket</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo nội dung / người raise"
                className="h-10 pl-9 pr-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | TicketStatus)}
              className="h-10 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm font-bold text-gray-700"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="open">Mới</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="resolved">Đã xử lý</option>
              <option value="closed">Đóng</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-16 text-center text-gray-400 font-semibold flex flex-col items-center gap-2">
            <MessageCircleWarning className="w-6 h-6" />
            Chưa có ticket phù hợp bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="bg-gray-50/70">
                  <th className="px-4 py-3 text-left text-[11px] font-black text-gray-400 uppercase">Vấn đề</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-gray-400 uppercase">Người raise</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-gray-400 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-gray-400 uppercase">Thời gian</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-gray-400 uppercase">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-gray-400 uppercase">Solution Note</th>
                  <th className="px-4 py-3 text-right text-[11px] font-black text-gray-400 uppercase">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-4 text-sm font-semibold text-gray-800 max-w-[300px]">{ticket.issue}</td>
                    <td className="px-4 py-4 text-sm font-bold text-gray-700">{ticket.raisedBy}</td>
                    <td className="px-4 py-4 text-xs font-black text-gray-500 uppercase">{roleLabel(ticket.raisedByRole)}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-500 whitespace-nowrap">{formatDateTime(ticket.raisedAt)}</td>
                    <td className="px-4 py-4">
                      <select
                        value={draftStatus[ticket.id] || ticket.status}
                        onChange={(e) => setDraftStatus((prev) => ({ ...prev, [ticket.id]: e.target.value as TicketStatus }))}
                        className={`h-9 rounded-xl border px-3 text-xs font-black ${statusStyle(draftStatus[ticket.id] || ticket.status)}`}
                      >
                        <option value="open">Mới</option>
                        <option value="in_progress">Đang xử lý</option>
                        <option value="resolved">Đã xử lý</option>
                        <option value="closed">Đóng</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 w-[360px]">
                      <textarea
                        rows={3}
                        value={draftSolution[ticket.id] ?? ticket.solutionNote ?? ""}
                        onChange={(e) =>
                          setDraftSolution((prev) => ({
                            ...prev,
                            [ticket.id]: e.target.value,
                          }))
                        }
                        placeholder="Nhập cách fix / ghi chú xử lý..."
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-700"
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => void handleSaveTicket(ticket.id)}
                        disabled={savingId === ticket.id}
                        className="h-9 px-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
                      >
                        {savingId === ticket.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Lưu
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
