"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, ChevronDown, ChevronUp, Target,
  Activity, Sparkles, BarChart2, Calendar, BookOpen,
  CheckCircle2, AlertTriangle, ArrowRight, Loader2,
  FileDown, Clock, Video, MessageSquare, SortAsc, SortDesc,
  User, GraduationCap, FileText, ArrowUpRight, ArrowDownRight,
  Minus, ChevronRight, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { resolveLearnerForParent } from "@/lib/services/learnerService";
import type { AiSummary, AiSummaryCard } from "@/app/api/child-ai-summary/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HpdtScore {
  overall: number;
  social: number;
  cognitive: number;
  behavior: number;
  sensory: number;
  motor: number;
}

interface AnalysisLog {
  analysisId: string;
  videoId: string;
  childId: string;
  videoUploadedAt: string | null;
  confirmedAt: string | null;
  senderRole: "parent" | "teacher" | "admin";
  fileName: string;
  hpdt: HpdtScore;
  regulationLevel: "dysregulated" | "transitioning" | "regulated";
  dominantBehavior: string;
  summary: string;
  keyInsights: string[];
  approach: string[];
  goals: { goalId: string; domain: string; targetBehavior: string; smartGoal: string; timeframe: string }[];
  collaborationMessage: string;
  lessonCount: number;
  videoLocation: string;
  videoTopic: string;
}

interface HpdtTrendPoint {
  date: string;
  overall: number;
  social: number;
  cognitive: number;
  behavior: number;
  sensory: number;
  motor: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const REGULATION_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  regulated:     { label: "Điều hòa tốt",     bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
  transitioning: { label: "Đang chuyển tiếp", bg: "bg-amber-100",   text: "text-amber-700",   icon: Activity      },
  dysregulated:  { label: "Mất điều hòa",     bg: "bg-red-100",     text: "text-red-700",     icon: AlertTriangle },
};

const HPDT_LABELS: Record<keyof HpdtScore, string> = {
  overall: "Tổng thể",
  social: "Xã hội",
  cognitive: "Nhận thức",
  behavior: "Hành vi",
  sensory: "Giác quan",
  motor: "Vận động",
};

const HPDT_COLORS: Record<keyof HpdtScore, string> = {
  overall: "#4F46E5",
  social: "#10b981",
  cognitive: "#8b5cf6",
  behavior: "#f59e0b",
  sensory: "#ec4899",
  motor: "#06b6d4",
};

const CARD_COLORS: Record<string, { bg: string; text: string; valueBg: string }> = {
  indigo:  { bg: "bg-indigo-50",  text: "text-indigo-700",  valueBg: "bg-indigo-100"  },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", valueBg: "bg-emerald-100" },
  purple:  { bg: "bg-purple-50",  text: "text-purple-700",  valueBg: "bg-purple-100"  },
  amber:   { bg: "bg-amber-50",   text: "text-amber-700",   valueBg: "bg-amber-100"   },
};

const SOURCE_CONFIG = {
  parent:  { label: "Phụ huynh", icon: User,           bg: "bg-pink-50",   text: "text-pink-600"  },
  teacher: { label: "Giáo viên", icon: GraduationCap,  bg: "bg-blue-50",   text: "text-blue-600"  },
  admin:   { label: "Hệ thống",  icon: Brain,          bg: "bg-gray-50",   text: "text-gray-500"  },
};

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-bold text-gray-500">{label}</span>
        <span className="text-xs font-black text-gray-700">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── AI Summary Section ───────────────────────────────────────────────────────

function AiSummarySection({
  summary,
  loading,
  childName,
  onRefresh,
}: {
  summary: AiSummary | null;
  loading: boolean;
  childName: string;
  onRefresh: () => void;
}) {
  const [showSteps, setShowSteps] = useState(false);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[2rem] border border-indigo-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
          <div>
            <div className="h-4 w-48 bg-indigo-100 rounded-full animate-pulse mb-1" />
            <div className="h-3 w-32 bg-indigo-50 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const trendIcon = summary.overallTrend === "improving"
    ? <ArrowUpRight className="w-4 h-4 text-emerald-500" />
    : summary.overallTrend === "declining"
    ? <ArrowDownRight className="w-4 h-4 text-red-400" />
    : <Minus className="w-4 h-4 text-gray-400" />;

  const trendBadge = summary.overallTrend === "improving"
    ? "bg-emerald-100 text-emerald-700"
    : summary.overallTrend === "declining"
    ? "bg-red-100 text-red-600"
    : "bg-gray-100 text-gray-500";

  const trendLabel = summary.overallTrend === "improving" ? "Đang tiến bộ"
    : summary.overallTrend === "declining" ? "Cần theo dõi"
    : "Ổn định";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-[2rem] border border-indigo-100 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Tổng hợp AI</p>
              <h2 className="text-base font-black text-gray-900 leading-tight">{summary.headline}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 ${trendBadge}`}>
              {trendIcon} {trendLabel}
            </span>
            <button
              onClick={onRefresh}
              className="w-7 h-7 rounded-xl bg-white/60 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors"
              title="Tải lại tổng hợp"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Key Cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {summary.keyCards.map((card: AiSummaryCard, i: number) => {
            const c = CARD_COLORS[card.color] ?? CARD_COLORS.indigo;
            return (
              <div key={i} className={`${c.bg} rounded-2xl p-3`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${c.text} opacity-70`}>{card.label}</p>
                <p className={`text-base font-black ${c.text}`}>{card.value}</p>
                <p className="text-[10px] text-gray-500 font-medium">{card.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Parent message */}
        <div className="bg-white/70 rounded-2xl px-4 py-3 text-sm text-gray-700 leading-relaxed font-medium">
          {summary.parentMessage}
        </div>
      </div>

      {/* Next steps (collapsible) */}
      <button
        onClick={() => setShowSteps((v) => !v)}
        className="w-full flex items-center justify-center gap-2 py-3 border-t border-indigo-100/50 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-700 hover:bg-white/40 transition-all"
      >
        {showSteps ? <><ChevronUp className="w-4 h-4" /> Ẩn gợi ý</> : <><ChevronRight className="w-4 h-4" /> Gợi ý thực hành</>}
      </button>
      <AnimatePresence>
        {showSteps && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-indigo-100/50"
          >
            <div className="px-6 py-4 space-y-2">
              {summary.nextSteps.map((step: string, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  sortOrder, setSortOrder,
  sourceFilter, setSourceFilter,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  resultCount, totalCount,
}: {
  sortOrder: "asc" | "desc";
  setSortOrder: (v: "asc" | "desc") => void;
  sourceFilter: "all" | "parent" | "teacher";
  setSourceFilter: (v: "all" | "parent" | "teacher") => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Row 1: Sort + Source */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Sort */}
        <div className="flex items-center bg-gray-50 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setSortOrder("desc")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all ${
              sortOrder === "desc" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <SortDesc className="w-3.5 h-3.5" /> Mới nhất
          </button>
          <button
            onClick={() => setSortOrder("asc")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all ${
              sortOrder === "asc" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <SortAsc className="w-3.5 h-3.5" /> Cũ nhất
          </button>
        </div>

        {/* Source filter */}
        <div className="flex items-center bg-gray-50 rounded-2xl p-1 gap-1">
          {(["all", "parent", "teacher"] as const).map((s) => {
            const label = s === "all" ? "Tất cả" : s === "parent" ? "Phụ huynh" : "Giáo viên";
            return (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${
                  sourceFilter === s ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Date range */}
      <div className="flex items-center gap-3">
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="flex-1 text-xs font-bold text-gray-700 bg-gray-50 rounded-2xl px-4 py-2.5 border-none outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <span className="text-xs text-gray-300 font-black">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="flex-1 text-xs font-bold text-gray-700 bg-gray-50 rounded-2xl px-4 py-2.5 border-none outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="text-[10px] font-black text-gray-400 hover:text-red-400 transition-colors px-2"
          >
            Xóa
          </button>
        )}
      </div>

      {/* Result count */}
      {(sourceFilter !== "all" || dateFrom || dateTo) && (
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Hiển thị {resultCount}/{totalCount} kết quả
        </p>
      )}
    </div>
  );
}

// ─── Log Card ─────────────────────────────────────────────────────────────────

function LogCard({ log, index }: { log: AnalysisLog; index: number }) {
  const [open, setOpen] = useState(false);
  const reg = REGULATION_CONFIG[log.regulationLevel] ?? REGULATION_CONFIG.transitioning;
  const RegIcon = reg.icon;
  const src = SOURCE_CONFIG[log.senderRole] ?? SOURCE_CONFIG.teacher;
  const SrcIcon = src.icon;

  const uploadDate = log.videoUploadedAt
    ? new Date(log.videoUploadedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  const confirmDate = log.confirmedAt
    ? new Date(log.confirmedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className="p-6">
        {/* Top row: index + source badge + regulation */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
              {index + 1}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Video className="w-3 h-3" /> {uploadDate}
                </span>
                {/* Source tag */}
                <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${src.bg} ${src.text}`}>
                  <SrcIcon className="w-3 h-3" /> {src.label}
                </span>
                {log.videoTopic && (
                  <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {log.videoTopic}
                  </span>
                )}
              </div>
              {confirmDate && (
                <p className="text-[10px] text-gray-300 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Phân tích: {confirmDate}
                </p>
              )}
            </div>
          </div>

          <span className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-1 flex-shrink-0 ${reg.bg} ${reg.text}`}>
            <RegIcon className="w-3 h-3" /> {reg.label}
          </span>
        </div>

        {/* HPDT Overall */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">HPDT Tổng thể</span>
              <span className="text-lg font-black text-indigo-700">
                {log.hpdt.overall}<span className="text-xs text-gray-400">/100</span>
              </span>
            </div>
            <div className="h-3 bg-indigo-50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${log.hpdt.overall}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
          <span className="text-xs font-bold text-gray-400">{log.lessonCount} bài</span>
        </div>

        {/* File name */}
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-3 h-3 text-gray-300 flex-shrink-0" />
          <span className="text-[10px] font-mono text-gray-300 truncate">{log.fileName}</span>
        </div>

        {/* Key insight */}
        {log.keyInsights[0] && (
          <div className="bg-indigo-50 rounded-2xl px-4 py-3 text-xs font-bold text-indigo-700 flex items-start gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-indigo-500" />
            {log.keyInsights[0]}
          </div>
        )}

        {log.summary && (
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{log.summary}</p>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 py-3 border-t border-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
      >
        {open ? <><ChevronUp className="w-4 h-4" /> Thu gọn</> : <><ChevronDown className="w-4 h-4" /> Chi tiết</>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-gray-50"
          >
            <div className="p-6 space-y-6">
              {/* HPDT breakdown */}
              <div>
                <h5 className="text-xs font-black text-gray-700 flex items-center gap-2 mb-3 uppercase tracking-widest">
                  <BarChart2 className="w-4 h-4 text-indigo-500" /> Chỉ số HPDT
                </h5>
                <div className="space-y-2.5">
                  {(["social", "cognitive", "behavior", "sensory", "motor"] as (keyof HpdtScore)[]).map((k) => (
                    <ScoreBar key={k} label={HPDT_LABELS[k]} value={log.hpdt[k]} color={HPDT_COLORS[k]} />
                  ))}
                </div>
              </div>

              {log.dominantBehavior && (
                <div>
                  <h5 className="text-xs font-black text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" /> Hành vi nổi bật
                  </h5>
                  <div className="bg-amber-50 rounded-2xl px-4 py-3 text-sm font-bold text-amber-800">
                    {log.dominantBehavior}
                  </div>
                </div>
              )}

              {log.keyInsights.length > 1 && (
                <div>
                  <h5 className="text-xs font-black text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" /> Nhận định AI
                  </h5>
                  <ul className="space-y-2">
                    {log.keyInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <ArrowRight className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {log.approach.length > 0 && (
                <div>
                  <h5 className="text-xs font-black text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" /> Hướng tiếp cận
                  </h5>
                  <ul className="space-y-1.5">
                    {log.approach.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-blue-50 rounded-xl px-3 py-2">
                        <CheckCircle2 className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {log.goals.length > 0 && (
                <div>
                  <h5 className="text-xs font-black text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-500" /> Mục tiêu can thiệp
                  </h5>
                  <div className="space-y-2">
                    {log.goals.map((g, i) => (
                      <div key={i} className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{g.domain}</span>
                          <span className="text-[10px] text-emerald-400">·</span>
                          <span className="text-[10px] text-emerald-500">{g.timeframe}</span>
                        </div>
                        <p className="text-xs font-bold text-gray-800 mb-0.5">{g.targetBehavior}</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed">{g.smartGoal}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {log.collaborationMessage && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Lời nhắn giáo viên
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed">{log.collaborationMessage}</p>
                </div>
              )}

              <a
                href={`/api/generate-report?analysisId=${log.analysisId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-orange-100 hover:border-orange-500"
              >
                <FileDown className="w-4 h-4" /> Tải báo cáo PDF
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── HPDT Trend Chart ─────────────────────────────────────────────────────────

function HpdtTrendChart({ trend }: { trend: HpdtTrendPoint[] }) {
  if (trend.length < 2) {
    return (
      <div className="bg-white rounded-[2rem] border border-gray-100 p-6 text-center text-sm text-gray-400 font-bold">
        Cần ít nhất 2 lần phân tích để hiển thị biểu đồ tiến độ.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-black text-gray-900 tracking-tight">Tiến độ HPDT theo thời gian</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Dựa theo ngày upload video</p>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: "bold" }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: "bold" }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
              itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
              labelStyle={{ fontSize: "12px", color: "#64748b", marginBottom: "4px", fontWeight: "bold" }}
            />
            <Legend wrapperStyle={{ fontSize: "10px", fontWeight: "bold", paddingTop: "10px" }} />
            <Line type="monotone" name="Tổng thể" dataKey="overall" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" name="Xã hội" dataKey="social" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" name="Nhận thức" dataKey="cognitive" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            <Line type="monotone" name="Hành vi" dataKey="behavior" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" name="Giác quan" dataKey="sensory" stroke="#ec4899" strokeWidth={2} dot={false} />
            <Line type="monotone" name="Vận động" dataKey="motor" stroke="#06b6d4" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ParentLibraryPage() {
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState("bé");
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [trend, setTrend] = useState<HpdtTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sourceFilter, setSourceFilter] = useState<"all" | "parent" | "teacher">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // AI Summary
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const userId = localStorage.getItem("userId");
      if (!userId) { setLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, "users", userId));
        const preferred = snap.exists() ? snap.data().childId : undefined;
        const learner = await resolveLearnerForParent(userId, preferred);
        if (!learner) { setLoading(false); return; }
        setChildId(learner.id);
        setChildName(learner.name || "bé");
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!childId) return;
    setLoading(true);
    fetch(`/api/child-analysis-log?childId=${encodeURIComponent(childId)}`)
      .then((r) => r.json())
      .then(({ logs: l = [], hpdtTrend: t = [] }) => {
        setLogs(l);
        setTrend(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [childId]);

  const fetchSummary = (id: string) => {
    setSummaryLoading(true);
    fetch(`/api/child-ai-summary?childId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then(({ summary }) => setAiSummary(summary ?? null))
      .catch(console.error)
      .finally(() => setSummaryLoading(false));
  };

  useEffect(() => {
    if (childId && logs.length > 0) fetchSummary(childId);
  }, [childId, logs.length]);

  // Use most-recent log with a non-zero score for hero display
  const latest = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].hpdt.overall > 0) return logs[i];
    }
    return logs.length > 0 ? logs[logs.length - 1] : null;
  }, [logs]);
  const oldest = useMemo(() => {
    for (let i = 0; i < logs.length; i++) {
      if (logs[i].hpdt.overall > 0) return logs[i];
    }
    return logs.length > 0 ? logs[0] : null;
  }, [logs]);
  const delta = latest && oldest ? latest.hpdt.overall - oldest.hpdt.overall : null;

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (sourceFilter !== "all") {
      result = result.filter((l) => l.senderRole === sourceFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((l) => {
        const d = l.videoUploadedAt ? new Date(l.videoUploadedAt).getTime() : 0;
        return d >= from;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // inclusive end of day
      result = result.filter((l) => {
        const d = l.videoUploadedAt ? new Date(l.videoUploadedAt).getTime() : 0;
        return d <= to;
      });
    }

    if (sortOrder === "desc") result = result.reverse();

    return result;
  }, [logs, sortOrder, sourceFilter, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-calming-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-calming-bg min-h-screen pb-32">
      {/* Header */}
      <header className="bg-white/50 backdrop-blur-md sticky top-0 z-40 py-4 -mx-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            Thư viện phân tích
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
            Hồ sơ tiến độ của {childName}
          </p>
        </div>
        <div className="px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tổng</p>
          <p className="text-2xl font-black text-indigo-600">{logs.length}</p>
        </div>
      </header>

      {logs.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-gray-200" />
          </div>
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Chưa có phân tích nào</p>
          <p className="text-xs text-gray-300 max-w-xs">
            Sau khi giáo viên phân tích video và lưu kết quả, dữ liệu sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <>
          {/* AI Summary */}
          <AiSummarySection
            summary={aiSummary}
            loading={summaryLoading}
            childName={childName}
            onRefresh={() => { if (childId) { setAiSummary(null); fetchSummary(childId); } }}
          />

          {/* Hero stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">HPDT Hiện tại</p>
              <p className="text-4xl font-black text-indigo-700">{latest?.hpdt.overall ?? "—"}</p>
              <p className="text-[10px] text-gray-400 font-bold">/100</p>
            </div>
            <div className={`rounded-[2rem] border p-5 shadow-sm ${delta !== null && delta >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${delta !== null && delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                Thay đổi
              </p>
              <p className={`text-4xl font-black ${delta !== null && delta >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {delta !== null ? (delta >= 0 ? "+" : "") + delta : "—"}
              </p>
              <p className="text-[10px] text-gray-400 font-bold">điểm so với lần đầu</p>
            </div>
          </div>

          {/* Trend chart */}
          <HpdtTrendChart trend={trend} />

          {/* Filter bar + Log list */}
          <div className="space-y-4">
            <FilterBar
              sortOrder={sortOrder} setSortOrder={setSortOrder}
              sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
              dateFrom={dateFrom} setDateFrom={setDateFrom}
              dateTo={dateTo} setDateTo={setDateTo}
              resultCount={filteredLogs.length}
              totalCount={logs.length}
            />

            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-black text-gray-300">Không có kết quả phù hợp</p>
              </div>
            ) : (
              filteredLogs.map((log, i) => (
                <LogCard key={log.analysisId} log={log} index={i} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
