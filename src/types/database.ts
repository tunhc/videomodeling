export type Role = "parent" | "teacher" | "admin";

export interface VideoMetadata {
  id: string;
  url: string;
  thumbnail?: string;
  senderId: string;
  childId: string;
  role: Role;
  primaryTag: string; // The behavioral category (e.g., social, communication)
  category?: string; // Human-readable category (e.g., Tự phục vụ, Vận động)
  lesson?: string; // Specific lesson name (e.g., Dọn dẹp bàn học)
  allTags: string[];
  context: "home" | "school" | "commute" | "public";
  topic: string; // Specific activity within tag
  status: "pending" | "Đã phân tích" | "flagged";
  parentNote?: string;
  expertNote?: string;
  verifiedTags: string[];
  duration?: number; // Duration in seconds
  location?: string; // Tag địa điểm (trường, nhà...)
  teacherId?: string; // Teacher assigned to this child
  teacherIds?: string[]; // All teachers allowed to access this video
  createdAt: any; // Firestore Timestamp
}

export interface InstructionTask {
  id: string;
  teacherId: string;
  parentId: string;
  childId: string;
  content: string;
  topic?: string;
  status: "unread" | "received" | "done" | "rejected";
  createdAt: any;
}

export interface NotePattern {
  id: string;
  childId: string;
  keyword: string;
  frequency: number;
  sources: {
    noteId: string;
    role: Role;
    timestamp: any;
  }[];
  isPromotedToTag: boolean;
  suggestedAt: any;
}

export interface HPDTStats {
  childId: string;
  overallScore: number;
  dimensions: {
    communication: number;
    social: number;
    behavior: number;
    sensory: number;
    sensor: number; // New hardware/sensor data dimension
  };
  lastUpdate: any;
}

export interface Child {
  id: string; // Document ID (e.g., KBC-HCM_Long-G20)
  name: string;
  initial: string;
  nickname?: string;
  birthday?: string | any; // YYYY-MM-DD or Timestamp
  age?: number;
  gender?: "B" | "G";
  status: string;
  hpdt: number;
  diagnosis?: string;
  schoolCode: string;
  teacherId: string;
  teacherIds?: string[];
  secondaryTeacherId?: string;
  secondaryTeacherIds?: string[];
  parentId: string;
  updatedAt: any;
}

export interface AppUser {
  id: string; // PH_... or GV_...
  displayName: string;
  role: Role;
  email?: string;
  password?: string; // Standard/Mock password
  childId?: string; // For parents
  teacherId?: string; // For parents
  childIds?: string[]; // For teachers/admins
  centerCode?: string;
  hpdt?: number;
  updatedAt: any;
}
