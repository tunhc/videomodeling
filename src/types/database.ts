export type Role = "parent" | "teacher" | "admin";

export interface VideoMetadata {
  id: string;
  url: string;
  thumbnail?: string;
  senderId: string;
  childId: string;
  role: Role;
  primaryTag: string; // The behavioral category
  allTags: string[]; 
  context: "home" | "school" | "commute" | "public";
  topic: string; // Specific activity within tag
  status: "pending" | "analyzed" | "flagged";
  parentNote?: string;
  expertNote?: string;
  verifiedTags: string[];
  duration?: number; // Duration in seconds
  teacherId?: string; // Teacher assigned to this child
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
