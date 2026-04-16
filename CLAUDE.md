@AGENTS.md
# CLAUDE.md — AI4AUTISM: Video Analysis & Intervention Platform

## Project Overview

Ứng dụng can thiệp tự kỷ dựa trên Video Modeling (VM). App đã có chức năng **collect video modeling** (upload/lưu trữ video). Giai đoạn tiếp theo: **tự động phân tích video → break thành các chặng hành vi → sinh bài học can thiệp cá nhân hóa → checklist thực hành → vòng lặp cải thiện liên tục**.

**Tech Stack:**
- Frontend: Antigravity (React-based)
- Database: Firebase Firestore
- Video Storage: Cloudinary
- AI Analysis: Claude API (claude-sonnet-4-20250514) via Anthropic `/v1/messages`
- Video Processing: Cloudinary transformation API + ffmpeg concepts

---

## Core Architecture

```
VIDEO (Cloudinary URL từ video_modeling collection)
    ↓
[Phase 1] Video Segmentation & Motion Analysis
    ↓ Claude API phân tích từ URL + metadata + child profile (hpdt_stats)
[Phase 2] Behavior Classification per Segment
    ↓ High motion / Low motion / Transition / Skill attempt
[Phase 3] Intervention Plan Generation
    ↓ ABA + DIR + OT approach, cá nhân hóa theo hpdt_stats của trẻ
[Phase 4] Lesson Checklist Output
    ↓ Checklist thực hành + Video Modeling tasks
    ↓ Gửi collaboration_tasks cho phụ huynh qua teacher
[Phase 5] Progress Tracking & Feedback Loop
    ↓ Upload video mới → video_modeling mới → so sánh → cải thiện bài học
```

---

## Firebase Collections — Thực tế từ Codebase

> ⚠️ Tất cả ID trong hệ thống dùng **String tự đặt** (không phải auto-ID của Firebase) để dễ đọc và debug. Ví dụ: `KBC-HCM_Khang-G19`, `GV_KimBinh`, `PH_KBC-HCM_Khang-G19`.

---

### 1. Collection: `users`

Tài khoản của Phụ huynh (`PH_`), Giáo viên (`GV_`), và Admin.

```js
{
  id: string,           // VD: "PH_KBC-HCM_Khang-G19", "GV_KimBinh"
  displayName: string,
  role: "parent" | "teacher" | "admin",
  email: string,
  password: string,
  centerCode: string,   // mã trung tâm (VD: "KBC-HCM")
  hpdt: number,

  // Chỉ dành cho parent:
  childId: string,      // ID của bé được quản lý
  teacherId: string,    // ID GV chính quản lý gia đình này

  // Chỉ dành cho teacher:
  childIds: string[],   // danh sách ID các bé được quản lý

  updatedAt: timestamp
}
```

**Phân quyền theo role:**
- `parent`: chỉ xem được data của `childId` tương ứng
- `teacher`: xem được tất cả bé trong `childIds`
- `admin`: full access

---

### 2. Collection: `children`

Hồ sơ học sinh. Trước đây có collection `students` — đã được **hợp nhất toàn bộ vào `children`**.

```js
{
  id: string,               // VD: "KBC-HCM_Khang-G19"
  name: string,
  nickname: string,         // Tên ở nhà
  birthday: string | timestamp,
  gender: "B" | "G",        // Boy / Girl
  status: string,
  hpdt: number,             // Thang điểm phát triển tổng hợp
  schoolCode: string,
  teacherId: string,
  parentId: string,
  secondaryTeacherId: string,
  teacherIds: string[],
  secondaryTeacherIds: string[]
}
```

**Lưu ý:** Không có `asdLevel` hay `profile.sensoryProfile` riêng — thông tin lâm sàng chi tiết nằm trong `hpdt_stats`.

---

### 3. Collection: `hpdt_stats`

Dữ liệu đánh giá phát triển của trẻ theo nhiều chiều. **Dùng thay cho `asdLevel` khi gọi Claude API.**

```js
{
  childId: string,
  overallScore: number,
  dimensions: {
    communication: number,  // Điểm giao tiếp
    social: number,         // Điểm kỹ năng xã hội
    behavior: number,       // Điểm hành vi
    sensory: number,        // Điểm điều hòa giác quan
    sensor: number          // Dữ liệu từ thiết bị phần cứng (nếu có)
  },
  lastUpdate: timestamp
}
```

---

### 4. Collection: `video_modeling`

Metadata của tất cả video hành vi và video mô hình hóa. **Collection `videos` cũ đã gộp vào đây.**

```js
{
  id: string,
  url: string,              // ⚠️ Dùng field này (không phải cloudinaryUrl)
  thumbnail: string,
  childId: string,
  senderId: string,         // ID người gửi (parent hoặc teacher)
  teacherId: string,
  role: "parent" | "teacher" | "admin",

  primaryTag: string,       // "social" | "communication" | "behavior" | "sensory" | "ADL" | "motor"
  category: string,         // VD: "Vận động", "Tự phục vụ", "Giao tiếp"
  lesson: string,           // Tên bài học liên quan
  topic: string,            // Hoạt động cụ thể

  context: "home" | "school" | "commute" | "public",
  duration: number,         // giây

  status: "pending" | "analyzed" | "flagged",  // ⚠️ Dùng "analyzed" (không phải "completed")

  parentNote: string,
  expertNote: string
}
```

**Field mapping — code cũ → code mới:**
```
video.cloudinaryUrl  →  video.url
video.uploadedBy     →  video.senderId
"completed"          →  "analyzed"   (giá trị của status)
```

---

### 5. Collection: `video_analysis`

Kết quả phân tích AI chi tiết. **Collection mới cần build cho phase này.**

```js
{
  id: string,               // VD: "VA_KBC-HCM_Khang-G19_20250416"
  videoId: string,          // Tham chiếu đến video_modeling.id
  childId: string,
  createdAt: timestamp,
  createdBy: string,        // teacherId hoặc "system"

  segments: [
    {
      segmentId: string,    // VD: "seg_001"
      startTime: number,    // giây
      endTime: number,
      motionLevel: "high" | "medium" | "low",
      motionScore: number,  // 0-100
      behaviorType: string,
      behaviorLabel: string,
      functionalAnalysis: string,
      interventionHint: string,
      clipUrl: string | null
    }
  ],

  summary: {
    dominantBehavior: string,
    regulationLevel: "dysregulated" | "transitioning" | "regulated",
    keyInsights: string[],
    overallRecommendation: string
  },

  interventionPlan: {
    planId: string,
    generatedAt: timestamp,
    approach: string[],
    goals: Goal[],
    lessons: Lesson[],
    masteryCriteria: MasteryCriteria[]
  },

  linkedTaskId: string | null   // collaboration_tasks.id tạo từ phân tích này
}
```

**Sau khi lưu xong:** Cập nhật `video_modeling.status = "analyzed"`.

---

### 6. Collection: `collaboration_tasks`

Nhiệm vụ, bài tập, hướng dẫn gửi qua lại giữa GV và PH.

```js
{
  id: string,
  teacherId: string,
  parentId: string,
  childId: string,
  content: string,          // Nội dung nhiệm vụ / hướng dẫn
  topic: string,
  status: "unread" | "received" | "done" | "rejected",
  createdAt: timestamp
}
```

**Tích hợp AI flow:** Sau khi sinh bài học từ `video_analysis`, GV tạo `collaboration_tasks` để gửi checklist/hướng dẫn cho PH thực hành tại nhà.

---

### 7. Collection: `note_patterns`

AI thu thập xu hướng từ ghi chú hành vi để gợi ý quy luật cho bé.

```js
{
  id: string,
  childId: string,
  keyword: string,
  frequency: number,
  sources: [
    { noteId: string, role: "parent" | "teacher", timestamp: timestamp }
  ],
  isPromotedToTag: boolean,
  suggestedAt: timestamp
}
```

---

### Collections mới cần tạo (Phase 2+)

#### `lessons`
```js
{
  id: string,               // VD: "LS_KBC-HCM_Khang-G19_001"
  childId: string,
  analysisId: string,       // video_analysis.id
  videoId: string,          // video_modeling.id nguồn
  title: string,
  targetBehavior: string,
  segmentRef: string,
  lessonType: "video_modeling" | "sensory_regulation" | "social_skill" | "ADL" | "emotion_regulation",
  vmType: "basic_vm" | "POV" | "VSM" | "peer_modeling",
  steps: [
    {
      stepId: string,
      order: number,
      title: string,
      description: string,
      duration: number,       // phút
      materials: string[],
      promptLevel: "full" | "partial" | "gesture" | "independent",
      therapistAction: string,
      childAction: string
    }
  ],
  checklist: [
    {
      itemId: string,
      description: string,
      category: "prerequisite" | "target" | "generalization",
      masteryTarget: number
    }
  ],
  uploadNewVideoTask: {
    prompt: string,
    targetSkillDemo: string,
    recordingGuidance: string[]
  },
  status: "active" | "mastered" | "modified",
  masteryThreshold: number,
  estimatedSessions: number,
  forRole: "teacher" | "parent" | "both",
  collaborationTaskId: string | null,
  createdAt: timestamp
}
```

#### `checklist_records`
```js
{
  id: string,               // VD: "CR_LS_..._20250416"
  lessonId: string,
  childId: string,
  recordedAt: timestamp,
  recordedBy: string,       // userId
  recordedByRole: "teacher" | "parent",
  items: [
    {
      checklistItemId: string,
      completed: boolean,
      promptUsed: string,
      notes: string
    }
  ],
  sessionNotes: string,
  videoUploadedThisSession: boolean,
  newVideoId: string | null,  // video_modeling.id của video mới upload
  overallScore: number        // 0-100
}
```

---

## Behavior Types

```
HIGH_MOTION (motionScore 50-100):
  - tantrum_episode         // Bùng phát hành vi / tantrum
  - startle_response        // Phản ứng giật mình
  - motor_seeking           // Tìm kiếm vận động mạnh
  - emotional_escalation    // Leo thang cảm xúc

MEDIUM_MOTION (motionScore 20-49):
  - skill_attempt           // Đang thử thực hiện kỹ năng
  - transition_behavior     // Hành vi chuyển tiếp
  - prompted_response       // Đáp lại sau khi được nhắc
  - social_initiation       // Khởi phát tương tác xã hội

LOW_MOTION (motionScore 0-19):
  - stimming_ritual         // Hành vi tự kích thích lặp lại
  - sensory_shutdown        // Đóng băng giác quan
  - focused_engagement      // Tập trung có mục tiêu
  - social_withdrawal       // Tách biệt xã hội
```

---

## Claude API Integration

### 1. Video Analysis — Phase 1 & 2

```js
// /src/services/videoAnalysis.js

export async function analyzeVideoWithClaude({ video, child, hpdtStats, frameDescriptions }) {
  // video      → từ collection video_modeling
  // child      → từ collection children
  // hpdtStats  → từ collection hpdt_stats (thay cho asdLevel)

  const systemPrompt = `Bạn là chuyên gia phân tích hành vi trẻ tự kỷ theo framework ABA + DIR/Floortime + OT.

Nhiệm vụ: Phân tích video can thiệp và chia thành các CHẶNG (segments) dựa trên patterns hành vi.

FRAMEWORK PHÂN LOẠI CHẶNG:
- HIGH MOTION (score 50-100): Bùng phát hành vi, tantrum, giật mình, tìm kiếm vận động mạnh
- MEDIUM MOTION (score 20-49): Thử kỹ năng, chuyển tiếp, đáp lại nhắc nhở
- LOW MOTION (score 0-19): Stimming, shutdown giác quan, tập trung, tách biệt xã hội

OUTPUT FORMAT: Trả về JSON hợp lệ, không có text nào khác:
{
  "segments": [
    {
      "segmentId": "seg_001",
      "startTime": 0,
      "endTime": 15,
      "motionLevel": "high|medium|low",
      "motionScore": 0-100,
      "behaviorType": "tantrum_episode|stimming_ritual|skill_attempt|...",
      "behaviorLabel": "Mô tả ngắn bằng tiếng Việt",
      "functionalAnalysis": "Phân tích chức năng: trẻ đang cần gì / đang trải qua gì",
      "interventionHint": "Gợi ý can thiệp tức thì"
    }
  ],
  "summary": {
    "dominantBehavior": "hành vi chiếm ưu thế",
    "regulationLevel": "dysregulated|transitioning|regulated",
    "keyInsights": ["insight 1", "insight 2", "insight 3"],
    "overallRecommendation": "Khuyến nghị tổng thể"
  }
}`;

  const userPrompt = `
Thông tin trẻ:
- Tên: ${child.name} (${child.nickname})
- Giới tính: ${child.gender === "B" ? "Bé trai" : "Bé gái"}
- Điểm HPDT tổng: ${hpdtStats.overallScore}
- Giao tiếp: ${hpdtStats.dimensions.communication} | Xã hội: ${hpdtStats.dimensions.social} | Hành vi: ${hpdtStats.dimensions.behavior} | Giác quan: ${hpdtStats.dimensions.sensory}

Thông tin video:
- Bối cảnh: ${video.context}
- Danh mục: ${video.category}
- Bài học: ${video.lesson} — Hoạt động: ${video.topic}
- Thời lượng: ${video.duration} giây
- Nhãn hành vi: ${video.primaryTag}
- Ghi chú phụ huynh: ${video.parentNote || "(không có)"}
- Ghi chú GV: ${video.expertNote || "(không có)"}
- URL video: ${video.url}

${frameDescriptions ? `Mô tả nội dung video:\n${frameDescriptions}` : ""}

Phân tích và break video thành các chặng hành vi.
`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  const data = await response.json();
  const rawText = data.content.map(b => b.text || "").join("");
  const clean = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
```

### 2. Intervention Plan Generation — Phase 3 & 4

```js
export async function generateInterventionPlan({ analysisResult, child, hpdtStats }) {
  const systemPrompt = `Bạn là chuyên gia thiết kế chương trình can thiệp tự kỷ theo phương pháp đa liệu pháp:
- ABA: Task analysis, củng cố dương tính, FCT, Differential Reinforcement
- DIR/Floortime: Đi theo lead của trẻ, xây dựng vòng tròn tương tác
- OT: Điều hòa giác quan, sensory diet, hộp bình tĩnh
- VM: POV, VSM (Video Self-Modeling), Peer Modeling, Basic VM

Mỗi bài học phải có:
1. Mục tiêu SMART
2. Các BƯỚC THỰC HIỆN chi tiết (Task Analysis)
3. CHECKLIST từng buổi (cho GV và PH)
4. TASK UPLOAD VIDEO MỚI để theo dõi tiến độ
5. TIÊU CHÍ THÀNH THẠO

OUTPUT FORMAT: JSON hợp lệ, không text khác:
{
  "approach": ["ABA", "DIR", "OT", "VM"],
  "goals": [
    {
      "goalId": "goal_001",
      "domain": "behavior|social|communication|ADL|motor|sensory|emotion",
      "targetBehavior": "...",
      "baselineDescription": "...",
      "smartGoal": "...",
      "timeframe": "4 tuần"
    }
  ],
  "lessons": [
    {
      "lessonId": "lesson_001",
      "title": "Tên bài học",
      "goalRef": "goal_001",
      "segmentRef": "seg_001",
      "lessonType": "video_modeling|sensory_regulation|social_skill|ADL|emotion_regulation",
      "vmType": "basic_vm|POV|VSM|peer_modeling",
      "rationale": "Lý do chọn dựa trên phân tích video",
      "steps": [
        {
          "stepId": "step_001",
          "order": 1,
          "title": "Tên bước",
          "description": "Mô tả chi tiết",
          "duration": 5,
          "materials": [],
          "promptLevel": "full|partial|gesture|independent",
          "therapistAction": "GV/PH làm gì",
          "childAction": "Trẻ làm gì"
        }
      ],
      "checklist": [
        {
          "itemId": "chk_001",
          "description": "Mục tiêu kiểm tra",
          "category": "prerequisite|target|generalization",
          "masteryTarget": 80
        }
      ],
      "uploadNewVideoTask": {
        "prompt": "Hãy quay video trẻ thực hiện...",
        "targetSkillDemo": "Kỹ năng cần thấy trong video mới",
        "recordingGuidance": ["Góc quay", "Ánh sáng", "Thời lượng"]
      },
      "masteryThreshold": 80,
      "estimatedSessions": 10,
      "forRole": "teacher|parent|both"
    }
  ],
  "masteryCriteria": [
    {
      "criteriaId": "mc_001",
      "description": "Tiêu chí thành thạo tổng thể",
      "measurement": "Cách đo lường",
      "target": "Mức cần đạt"
    }
  ],
  "collaborationMessage": "Thông điệp GV gửi PH kèm bài học — ngắn, ấm áp, tiếng Việt đơn giản"
}`;

  const userPrompt = `
Trẻ: ${child.name} — ${child.nickname}
HPDT: ${hpdtStats.overallScore} | Giao tiếp: ${hpdtStats.dimensions.communication} | Xã hội: ${hpdtStats.dimensions.social} | Hành vi: ${hpdtStats.dimensions.behavior} | Giác quan: ${hpdtStats.dimensions.sensory}

KẾT QUẢ PHÂN TÍCH VIDEO:
${JSON.stringify(analysisResult, null, 2)}

Tạo kế hoạch can thiệp cá nhân hóa. Với bài dành cho phụ huynh (forRole: "parent" hoặc "both"), ngôn ngữ phải đơn giản, không dùng thuật ngữ chuyên môn.
`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  const data = await response.json();
  const rawText = data.content.map(b => b.text || "").join("");
  const clean = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
```

### 3. Progress Comparison — Phase 5

```js
export async function compareProgressVideos({ originalAnalysis, newAnalysis, child, hpdtStats, lessonsCompleted }) {
  const systemPrompt = `Bạn là chuyên gia đánh giá tiến độ can thiệp tự kỷ.
So sánh 2 phân tích video để đánh giá tiến độ và điều chỉnh bài học.

OUTPUT FORMAT: JSON hợp lệ:
{
  "progressReport": {
    "overallTrend": "improving|stable|declining",
    "improvementAreas": ["lĩnh vực cải thiện"],
    "persistentChallenges": ["thách thức còn tồn tại"],
    "newChallengesIdentified": ["thách thức mới"]
  },
  "lessonAdjustments": [
    {
      "lessonId": "lesson_001",
      "action": "continue|modify|archive|escalate",
      "rationale": "Lý do",
      "modifications": "Thay đổi cụ thể nếu cần"
    }
  ],
  "newLessonsRecommended": [
    {
      "title": "Bài học mới đề xuất",
      "rationale": "Lý do",
      "priority": "high|medium|low"
    }
  ],
  "hpdtImpact": {
    "estimatedChange": "Ước tính thay đổi HPDT",
    "domainHighlights": "Khía cạnh tiến bộ rõ nhất"
  },
  "parentMessage": "Thông điệp động lực cho phụ huynh — ấm áp, cụ thể, tập trung vào tiến bộ"
}`;

  const userPrompt = `
Trẻ: ${child.name} — HPDT hiện tại: ${hpdtStats.overallScore}
Số buổi đã hoàn thành: ${lessonsCompleted}

PHÂN TÍCH VIDEO CŨ:
${JSON.stringify(originalAnalysis.summary, null, 2)}

PHÂN TÍCH VIDEO MỚI:
${JSON.stringify(newAnalysis.summary, null, 2)}
`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  const data = await response.json();
  const rawText = data.content.map(b => b.text || "").join("");
  const clean = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
```

---

## Data Access Patterns

```js
// Lấy child từ ID của parent
const parentDoc = await getDoc(doc(db, "users", userId))
const childId = parentDoc.data().childId          // VD: "KBC-HCM_Khang-G19"
const childDoc = await getDoc(doc(db, "children", childId))

// Lấy hpdt_stats
const hpdtQuery = query(collection(db, "hpdt_stats"), where("childId", "==", childId))

// Lấy videos (dùng video_modeling — KHÔNG dùng videos)
const videosQuery = query(
  collection(db, "video_modeling"),
  where("childId", "==", childId),
  orderBy("createdAt", "desc")
)

// Lấy video chưa phân tích
const pendingQuery = query(
  collection(db, "video_modeling"),
  where("childId", "==", childId),
  where("status", "==", "pending")
)

// Sau khi phân tích: update status
await updateDoc(doc(db, "video_modeling", videoId), { status: "analyzed" })

// Lưu kết quả phân tích
const analysisId = `VA_${childId}_${Date.now()}`
await setDoc(doc(db, "video_analysis", analysisId), {
  id: analysisId,
  videoId: video.id,
  childId,
  createdAt: serverTimestamp(),
  createdBy: currentUser.uid,
  ...analysisResult
})

// Tạo collaboration_task từ bài học
const taskId = `TASK_${childId}_${Date.now()}`
await setDoc(doc(db, "collaboration_tasks", taskId), {
  id: taskId,
  teacherId: child.teacherId,
  parentId: child.parentId,
  childId,
  content: interventionPlan.collaborationMessage,
  topic: lesson.title,
  status: "unread",
  createdAt: serverTimestamp()
})
```

---

## UI Components to Build

### 1. `VideoAnalysisView`

```
┌─────────────────────────────────────────┐
│  [Video Player — Cloudinary embed]      │
│  ████████████░░░░░░░░ 00:45 / 02:44    │
├─────────────────────────────────────────┤
│  PHÂN TÍCH CHẶNG                        │
│  ┌──────┬──────────────────────────┐   │
│  │ 0-15s│ 🔴 HIGH | Bùng phát HV  │   │
│  │15-32s│ 🟡 MED  | Thử kỹ năng   │   │
│  │33-42s│ 🟢 LOW  | Stimming       │   │
│  └──────┴──────────────────────────┘   │
│  [Click chặng → xem chi tiết]           │
├─────────────────────────────────────────┤
│  [🧠 Tạo Bài Học Can Thiệp]             │
└─────────────────────────────────────────┘
```

Segment color coding:
- `motionScore >= 50` → `#FF4444` (đỏ)
- `motionScore 20-49` → `#FFB800` (vàng)
- `motionScore < 20`  → `#22C55E` (xanh)

### 2. `LessonCard`

```
┌─────────────────────────────────────────┐
│ 📹 Bài 1: Điều hòa Giác quan            │
│ [ABA] [OT]   Dựa trên: 0-15s, 33-42s   │
├─────────────────────────────────────────┤
│ Mục tiêu: Giảm stimming 50% / 4 tuần   │
│                                         │
│ CHECKLIST BUỔI HÔM NAY                  │
│ ☐ Khởi động: Chạm cát động lực (5p)    │
│ ☐ Nặn đất sét tạo hình (10p)           │
│ ☐ Bóp bóng gai thay stimming (5p)      │
│ ☐ Nằm chăn nặng + nhạc thiên nhiên     │
│                                         │
│ Tiến độ: ██████░░░░ 3/10 buổi          │
├─────────────────────────────────────────┤
│ [📹 Upload Video Mới] [✅ Ghi Kết Quả]  │
└─────────────────────────────────────────┘
```

### 3. `CollaborationTaskBanner` — Thông báo cho Parent

```
┌─────────────────────────────────────────┐
│ 👩‍🏫 Cô [tên GV] gửi bài tập mới!       │
│ "Bài: Điều hòa giác quan — Hộp bình..." │
│ [Xem Chi Tiết]  [✓ Đã Nhận]            │
└─────────────────────────────────────────┘
```

### 4. `VideoUploadTask`

```
┌─────────────────────────────────────────┐
│ 🎬 Đến lúc quay video tiến độ rồi!     │
│ Kỹ năng cần quay: Trẻ tự mặc áo       │
│                                         │
│ • Góc quay: từ bên hông, cao ngang vai │
│ • Ánh sáng: đủ sáng, không ngược sáng │
│ • Thời lượng: 2-5 phút                 │
│ • Không nhắc trẻ trong lúc quay        │
│                                         │
│ [📁 Chọn Video]  [☁️ Upload]           │
└─────────────────────────────────────────┘
```

### 5. `ProgressDashboard`

- Biểu đồ `motionScore` trung bình qua các lần video
- Số lần bùng phát (high motion) theo ngày/tuần
- % checklist hoàn thành
- HPDT trend nếu có cập nhật

---

## App Flow (User Journey)

```
TEACHER FLOW:
1. Login → load childIds → chọn trẻ → load children + hpdt_stats
2. Video List → query video_modeling by childId, status: "pending"
3. Chọn video → VideoAnalysisView
4. [Phân tích] → analyzeVideoWithClaude → lưu video_analysis → set status "analyzed"
5. Xem segments timeline → click chặng → chi tiết + interventionHint
6. [Tạo Bài Học] → generateInterventionPlan → lưu lessons
7. [Gửi cho PH] → tạo collaboration_tasks → PH thấy banner

PARENT FLOW:
1. Login → load childId → xem CollaborationTaskBanner nếu có unread task
2. Nhận task → "Đã nhận" → update status: "received"
3. Thực hành theo LessonCard → tick checklist → lưu checklist_records
4. Khi đủ buổi → VideoUploadTask hiện → upload video → tạo video_modeling mới (status: "pending")
5. GV thấy video mới → phân tích → compareProgressVideos → vòng lặp mới

FEEDBACK LOOP:
Video mới (status: "pending")
  → Teacher phân tích → video_analysis mới
  → compareProgressVideos với analysis cũ
  → Điều chỉnh lessons
  → Gửi collaboration_tasks mới cho PH
```

---

## Key Implementation Notes

### ID Convention (bắt buộc)

```js
// ✅ Luôn dùng String ID tự đặt
const analysisId = `VA_${childId}_${Date.now()}`
const lessonId   = `LS_${childId}_${lessonIndex}`
const taskId     = `TASK_${childId}_${Date.now()}`
const recordId   = `CR_${lessonId}_${Date.now()}`

// ❌ Không dùng addDoc (auto-ID)
```

### Video Field Mapping (tránh bug)

```js
// ❌ SAI — code cũ
video.cloudinaryUrl
video.uploadedBy
video.analysisStatus === "completed"

// ✅ ĐÚNG — hiện tại
video.url
video.senderId
video.status === "analyzed"
```

### Video Segmentation Strategy

**Option A — MVP:** User mô tả video khi upload (parentNote / expertNote) → Claude dùng mô tả để phân đoạn

**Option B — Advanced:** Cloudinary thumbnail extraction
```js
const frameUrl = (publicId, second) =>
  `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_${second}/${publicId}.jpg`
// Lấy frame mỗi 5s → gửi vào Claude vision
```

**Option C — Future:** ffmpeg backend cho optical flow / motion score thực sự

### Prompt Language

- Output cho GV: tiếng Việt chuyên nghiệp, có thể dùng ABA/DIR/OT
- Output cho PH (`forRole: "parent"`): tiếng Việt đơn giản, ấm áp, không phán xét, không thuật ngữ
- Tên kỹ thuật giữ nguyên: ABA, DIR, OT, VM, VSM, POV, stimming, tantrum

### Error Handling

```js
try {
  const result = await analyzeVideoWithClaude(params)
  if (!result.segments || !result.summary) throw new Error("Invalid AI response")
  return result
} catch (err) {
  // Giữ nguyên status "pending" để có thể retry
  console.error("Analysis failed:", err)
  return { error: "Phân tích thất bại. Vui lòng thử lại." }
}
```

### Firebase Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /children/{childId} {
      allow read: if request.auth != null &&
        (resource.data.parentId == request.auth.uid ||
         resource.data.teacherIds.hasAny([request.auth.uid]));
      allow write: if request.auth != null;
    }

    match /video_modeling/{videoId} {
      allow read, write: if request.auth != null;
    }

    match /video_analysis/{analysisId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    match /collaboration_tasks/{taskId} {
      allow read: if request.auth != null &&
        (resource.data.parentId == request.auth.uid ||
         resource.data.teacherId == request.auth.uid);
      allow write: if request.auth != null;
    }

    match /lessons/{lessonId}         { allow read, write: if request.auth != null; }
    match /checklist_records/{id}     { allow read, write: if request.auth != null; }
    match /hpdt_stats/{id}            { allow read, write: if request.auth != null; }
    match /users/{userId}             { allow read, write: if request.auth != null; }
    match /note_patterns/{id}         { allow read, write: if request.auth != null; }
  }
}
```

---

## Reference Constants

```js
export const PRIMARY_TAGS = {
  social: "Kỹ năng xã hội",
  communication: "Giao tiếp",
  behavior: "Hành vi",
  sensory: "Điều hòa giác quan",
  ADL: "Tự phục vụ",
  motor: "Vận động"
}

export const CATEGORIES = [
  "Vận động", "Tự phục vụ", "Giao tiếp", "Xã hội",
  "Điều hòa cảm xúc", "Nhận thức", "Chuyển tiếp"
]

export const VM_TYPES = {
  basic_vm:      "Basic VM — Người lớn làm mẫu",
  POV:           "Point-of-View — Góc nhìn của trẻ",
  VSM:           "Video Self-Modeling — Trẻ tự làm mẫu",
  peer_modeling: "Peer Modeling — Bạn cùng tuổi làm mẫu"
}

export const CONTEXT_TYPES = {
  home:    "Tại nhà",
  school:  "Tại trường",
  commute: "Di chuyển",
  public:  "Nơi công cộng"
}

export const TASK_STATUS_FLOW = {
  unread:   "Chưa đọc",
  received: "Đã nhận",
  done:     "Đã hoàn thành",
  rejected: "Không thực hiện được"
}
```

---

## Roadmap

**Phase 1 (Done):** Video collection — upload lên `video_modeling` ✅

**Phase 2 (Build now):**
- [ ] `VideoAnalysisView` — đọc từ `video_modeling`, lưu vào `video_analysis`
- [ ] Segment timeline visualization (color-coded)
- [ ] `generateInterventionPlan` → lưu vào `lessons`
- [ ] `LessonCard` + checklist → lưu vào `checklist_records`
- [ ] Auto-create `collaboration_tasks` khi GV tạo bài học

**Phase 3:**
- [ ] Parent view: nhận task, tick checklist, upload video mới
- [ ] `CollaborationTaskBanner` + notification flow
- [ ] `compareProgressVideos` khi có video mới

**Phase 4:**
- [ ] `ProgressDashboard` với charts
- [ ] Cloudinary thumbnail extraction cho frame analysis
- [ ] HPDT auto-update dựa trên `checklist_records`

**Phase 5 (Vision):**
- [ ] Real-time motion scoring
- [ ] Digital Twin (pDT) integration dựa trên `hpdt_stats`
- [ ] Predictive behavior alerts từ `note_patterns`

---

## Important Context

App phục vụ trẻ ASD tại Việt Nam. Phương pháp can thiệp:
- **Video Modeling (VM):** Trẻ học qua quan sát (mirror neuron system)
- **ABA:** Task analysis, củng cố dương tính, FCT
- **DIR/Floortime:** Đi theo lead của trẻ, emotional connection
- **OT/Sensory Integration:** Điều hòa giác quan trước khi học

**Nguyên tắc cốt lõi:** Mỗi trẻ là duy nhất. Cá nhân hóa bài học dựa trên `hpdt_stats` thực tế. Video là nguồn dữ liệu khách quan nhất để hiểu trẻ. Vòng lặp **video → phân tích → bài học → video mới** là trái tim của hệ thống.
