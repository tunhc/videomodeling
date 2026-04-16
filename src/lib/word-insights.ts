export type WordDomain = "communication" | "social" | "behavior" | "sensory" | "motor";

export interface WordIndicators {
  communication: number;
  social: number;
  behavior: number;
  sensory: number;
  motor: number;
  overall: number;
  confidence: number;
}

export interface WordInterventionLesson {
  title: string;
  description: string;
  domain: string;
  priority: "high" | "medium" | "low";
}

export interface LatestWordInsights {
  sourceDocId?: string;
  fileName?: string;
  updatedAt?: unknown;
  summary: string;
  highlights: string[];
  indicators: WordIndicators;
  interventionLessons: WordInterventionLesson[];
  wordCount: number;
  characterCount: number;
}

const DOMAIN_KEYWORDS: Record<WordDomain, string[]> = {
  communication: ["giao tiếp", "ngôn ngữ", "trả lời", "yêu cầu", "chào", "lời nói", "nhìn mắt"],
  social: ["xã hội", "tương tác", "bạn", "nhóm", "luân phiên", "hợp tác", "chờ lượt"],
  behavior: ["hành vi", "tự phục vụ", "tuân thủ", "chuyển tiếp", "quy tắc", "nổi giận", "kích động"],
  sensory: ["giác quan", "cảm giác", "xúc giác", "quá tải", "âm thanh", "ánh sáng", "điều hòa"],
  motor: ["vận động", "thăng bằng", "cầm nắm", "vận động tinh", "vận động thô", "phối hợp", "tay"],
};

const DOMAIN_LABELS: Record<WordDomain, string> = {
  communication: "Giao tiếp",
  social: "Xã hội",
  behavior: "Hành vi",
  sensory: "Giác quan",
  motor: "Vận động",
};

const POSITIVE_WORDS = ["tiến bộ", "ổn định", "cải thiện", "hợp tác", "chủ động", "đạt", "tốt"];
const CHALLENGE_WORDS = ["khó", "hạn chế", "chậm", "kích động", "né", "quá tải", "giảm"];

const INTERVENTION_LIBRARY: Record<WordDomain, { title: string; description: string }> = {
  communication: {
    title: "Giao tiếp mắt và yêu cầu có mục đích",
    description:
      "Mỗi phiên 3-5 lượt: gọi tên, chờ giao tiếp mắt 2-3 giây, sau đó gợi ý trẻ đưa yêu cầu ngắn bằng lời hoặc thẻ.",
  },
  social: {
    title: "Luân phiên tương tác 1-1",
    description:
      "Thiết kế trò chơi chia lượt ngắn (3-5 phút), tăng dần thời gian chờ lượt và củng cố hành vi hợp tác tích cực.",
  },
  behavior: {
    title: "Chuỗi tự phục vụ theo từng bước",
    description:
      "Tách kỹ năng thành các bước nhỏ có hình ảnh minh họa, luyện đúng trình tự và thưởng ngay sau mỗi bước hoàn thành.",
  },
  sensory: {
    title: "Điều hòa cảm giác trước hoạt động chính",
    description:
      "Bố trí 3-5 phút hoạt động cảm giác phù hợp trước giờ học để giảm quá tải và tăng khả năng duy trì chú ý.",
  },
  motor: {
    title: "Bài tập phối hợp tay-mắt",
    description:
      "Thực hiện các bài cầm nắm, gắp-thả, bắt chước động tác với mức khó tăng dần để cải thiện kiểm soát vận động.",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function countWordMatches(text: string, keywords: string[]) {
  let total = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) total += 1;
  }
  return total;
}

function extractHighlights(text: string) {
  const chunks = text
    .replace(/\r\n/g, "\n")
    .split(/[\n.!?]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 24);

  return chunks.slice(0, 4);
}

function buildSummary(highlights: string[]) {
  if (highlights.length === 0) {
    return "Đã nạp hồ sơ Word thành công. Hệ thống đang chờ thêm dữ liệu để tăng độ chính xác của chỉ số.";
  }

  if (highlights.length === 1) {
    return highlights[0];
  }

  return `${highlights[0]}. ${highlights[1]}.`;
}

function priorityFromScore(score: number): "high" | "medium" | "low" {
  if (score <= 55) return "high";
  if (score <= 72) return "medium";
  return "low";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function formatFirestoreLikeDate(value: unknown) {
  if (!value) return "Vừa cập nhật";
  if (value instanceof Date) return value.toLocaleString("vi-VN");

  const record = toRecord(value);
  if (!record) return "Vừa cập nhật";

  const toDate = record.toDate;
  if (typeof toDate === "function") {
    try {
      const asDate = toDate.call(value) as Date;
      return asDate.toLocaleString("vi-VN");
    } catch {
      return "Vừa cập nhật";
    }
  }

  return "Vừa cập nhật";
}

export function buildWordInsightsFromText(text: string): Omit<LatestWordInsights, "sourceDocId" | "fileName" | "updatedAt"> {
  const normalizedText = text.trim();
  const lower = normalizedText.toLowerCase();
  const words = normalizedText.split(/\s+/).filter(Boolean).length;

  const positiveHits = countWordMatches(lower, POSITIVE_WORDS);
  const challengeHits = countWordMatches(lower, CHALLENGE_WORDS);
  const coverageBoost = Math.min(14, Math.floor(words / 90));

  const domainHits: Record<WordDomain, number> = {
    communication: countWordMatches(lower, DOMAIN_KEYWORDS.communication),
    social: countWordMatches(lower, DOMAIN_KEYWORDS.social),
    behavior: countWordMatches(lower, DOMAIN_KEYWORDS.behavior),
    sensory: countWordMatches(lower, DOMAIN_KEYWORDS.sensory),
    motor: countWordMatches(lower, DOMAIN_KEYWORDS.motor),
  };

  const indicators: WordIndicators = {
    communication: 0,
    social: 0,
    behavior: 0,
    sensory: 0,
    motor: 0,
    overall: 0,
    confidence: 0,
  };

  (Object.keys(domainHits) as WordDomain[]).forEach((domain) => {
    const score =
      38 +
      coverageBoost +
      domainHits[domain] * 8 +
      positiveHits -
      challengeHits * 2;

    indicators[domain] = clamp(Math.round(score), 25, 95);
  });

  indicators.overall = Math.round(
    (indicators.communication +
      indicators.social +
      indicators.behavior +
      indicators.sensory +
      indicators.motor) /
      5
  );

  const mentionedDomains = (Object.keys(domainHits) as WordDomain[]).filter((domain) => domainHits[domain] > 0).length;
  indicators.confidence = clamp(35 + Math.floor(words / 20) + mentionedDomains * 7, 35, 96);

  const orderedDomains = (Object.keys(domainHits) as WordDomain[]).sort(
    (a, b) => indicators[a] - indicators[b]
  );

  const interventionLessons: WordInterventionLesson[] = orderedDomains.slice(0, 4).map((domain) => {
    const lesson = INTERVENTION_LIBRARY[domain];
    return {
      title: lesson.title,
      description: lesson.description,
      domain: DOMAIN_LABELS[domain],
      priority: priorityFromScore(indicators[domain]),
    };
  });

  const highlights = extractHighlights(normalizedText);

  return {
    summary: buildSummary(highlights),
    highlights,
    indicators,
    interventionLessons,
    wordCount: words,
    characterCount: normalizedText.length,
  };
}

export function normalizeWordInsights(raw: unknown): LatestWordInsights | null {
  const record = toRecord(raw);
  if (!record) return null;

  const indicatorsRaw = toRecord(record.indicators);
  if (!indicatorsRaw) return null;

  const lessonsRaw = Array.isArray(record.interventionLessons) ? record.interventionLessons : [];
  const lessons: WordInterventionLesson[] = lessonsRaw
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => {
      const priorityRaw = asString(item.priority).toLowerCase();
      const priority: "high" | "medium" | "low" =
        priorityRaw === "high" || priorityRaw === "medium" || priorityRaw === "low"
          ? priorityRaw
          : "medium";

      return {
        title: asString(item.title),
        description: asString(item.description),
        domain: asString(item.domain),
        priority,
      };
    })
    .filter((item) => item.title && item.description);

  const highlightsRaw = Array.isArray(record.highlights) ? record.highlights : [];
  const highlights = highlightsRaw.map((item) => asString(item)).filter(Boolean);

  return {
    sourceDocId: asString(record.sourceDocId) || undefined,
    fileName: asString(record.fileName) || undefined,
    updatedAt: record.updatedAt,
    summary: asString(record.summary),
    highlights,
    indicators: {
      communication: asNumber(indicatorsRaw.communication, 0),
      social: asNumber(indicatorsRaw.social, 0),
      behavior: asNumber(indicatorsRaw.behavior, 0),
      sensory: asNumber(indicatorsRaw.sensory, 0),
      motor: asNumber(indicatorsRaw.motor, 0),
      overall: asNumber(indicatorsRaw.overall, 0),
      confidence: asNumber(indicatorsRaw.confidence, 0),
    },
    interventionLessons: lessons,
    wordCount: asNumber(record.wordCount, 0),
    characterCount: asNumber(record.characterCount, 0),
  };
}