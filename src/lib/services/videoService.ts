import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy
} from "firebase/firestore";
import { VideoMetadata, Role } from "@/types/database";
import { cloudinaryService } from "./cloudinaryService";
import { getDoc } from "firebase/firestore";

export const videoService = {
  /**
   * Get a single video by ID with automatic de-obfuscation
   */
  async getVideoById(videoId: string) {
    const docRef = doc(db, "video_modeling", videoId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as any;
      return {
        id: snap.id,
        ...data,
        url: cloudinaryService.deobfuscateUrl(data.url)
      };
    }
    return null;
  },

  /**
   * Register video metadata in Firestore after successful storage upload (Cloudinary)
   */
  async registerVideoMetadata(
    videoUrl: string, 
    childId: string, 
    primaryTag: string, 
    metadata: Partial<VideoMetadata>,
    role: Role
  ) {
    // 1. Resolve Teacher ID for this child for data isolation
    let assignedTeacherId = metadata.teacherId || "";
    if (!assignedTeacherId) {
      try {
        const childSnap = await getDoc(doc(db, "children", childId));
        if (childSnap.exists()) {
          assignedTeacherId = childSnap.data().teacherId || "";
        }
      } catch (e) {
        console.error("Failed to resolve teacherId for child:", childId, e);
      }
    }

    // 2. Optimize and Obfuscate URL for database storage privacy as requested
    const optimizedUrl = cloudinaryService.optimizeUrl(videoUrl);
    const storedUrl = cloudinaryService.obfuscateUrl(optimizedUrl);

    const videoData: Omit<VideoMetadata, "id"> = {
      url: storedUrl, // Obfuscated
      senderId: metadata.senderId || "current-user-id",
      childId: childId,
      teacherId: assignedTeacherId, // Added for isolation
      role: role,
      primaryTag: primaryTag,
      category: metadata.category || "", // Added for ABA mapping
      lesson: metadata.lesson || "", // Added for ABA mapping
      allTags: [primaryTag, ...(metadata.allTags || [])],
      context: metadata.context || "home",
      topic: metadata.topic || "Hoạt động tự phát",
      status: "pending",
      verifiedTags: [],
      createdAt: serverTimestamp(),
      duration: metadata.duration || 0,
      location: metadata.location || "",
      ...metadata
    };

    const docRef = await addDoc(collection(db, "video_modeling"), videoData);
    return { id: docRef.id, ...videoData };
  },

  /**
   * Get filtered recent videos based on user role and identity
   */
  async getRecentVideos(options: { 
    role?: Role | "admin", 
    userId?: string, 
    childId?: string,
    limitCount?: number 
  } = {}) {
    const { role, userId, childId, limitCount = 50 } = options;
    
    let q = query(collection(db, "video_modeling"));

    // Apply filtering logic based on role
    if (role === "admin") {
      // Admin sees everything
    } else if (role === "parent" && childId) {
      // Parent only sees their child's videos
      q = query(collection(db, "video_modeling"), where("childId", "==", childId));
    } else if (role === "teacher" && userId) {
      // Teacher only sees videos for children they teach
      q = query(collection(db, "video_modeling"), where("teacherId", "==", userId));
    }

    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data,
        url: cloudinaryService.deobfuscateUrl(data.url)
      };
    });

    // Sort in memory by createdAt desc (avoiding composite index requirement)
    return list.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    }).slice(0, limitCount);
  },

  /**
   * Get videos by tag for a specific child
   */
  async getVideosByTag(childId: string, tag: string) {
    const q = query(
      collection(db, "video_modeling"), 
      where("childId", "==", childId),
      where("primaryTag", "==", tag)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as any;
      return { 
        id: doc.id, 
        ...data,
        // Deobfuscate URL for frontend usage
        url: cloudinaryService.deobfuscateUrl(data.url)
      };
    });
  },

  /**
   * Delete video metadata
   */
  async deleteVideo(videoId: string, createdAt: any) {
    let createdDate;
    if (!createdAt || typeof createdAt.toDate !== 'function') {
      createdDate = new Date();
    } else {
      createdDate = createdAt.toDate();
    }
    
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    const oneHourMs = 3600000;

    if (diffMs > oneHourMs) return false;

    await deleteDoc(doc(db, "video_modeling", videoId));
    return true;
  },

  /**
   * Get count of videos uploaded today
   */
  async getDailyVideoCount(childId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, "video_modeling"), 
      where("childId", "==", childId)
    );
    const snapshot = await getDocs(q);
    
    // Filter by date in memory to avoid composite index requirement
    const todayMillis = today.getTime();
    const todayVideos = snapshot.docs.filter(doc => {
      const createdAt = doc.data().createdAt;
      return createdAt?.toMillis?.() >= todayMillis;
    });
    
    return todayVideos.length;
  }
};
