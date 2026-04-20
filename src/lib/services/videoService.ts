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
  deleteDoc
} from "firebase/firestore";
import { VideoMetadata, Role } from "@/types/database";
import { cloudinaryService } from "./cloudinaryService";
import { extractTeacherIds, mergeTeacherIds } from "./teacher-assignment";
import { getLearnersForTeacher } from "./learnerService";
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
    if (videoUrl.startsWith("data:")) {
      throw new Error("Không hỗ trợ lưu trữ video dưới dạng Base64. Vui lòng upload lên Cloudinary để lấy link HTTP chuẩn.");
    }

    // 1. Resolve Teacher ID for this child for data isolation
    let assignedTeacherId = metadata.teacherId || "";
    let assignedTeacherIds = mergeTeacherIds(
      Array.isArray(metadata.teacherIds) ? metadata.teacherIds : undefined,
      assignedTeacherId ? [assignedTeacherId] : undefined
    );

    if (!assignedTeacherId) {
      try {
        const childSnap = await getDoc(doc(db, "children", childId));
        if (childSnap.exists()) {
          const childData = childSnap.data() as Record<string, unknown>;
          const resolvedTeacherIds = extractTeacherIds(childData);
          assignedTeacherIds = mergeTeacherIds(assignedTeacherIds, resolvedTeacherIds);
          assignedTeacherId =
            typeof childData.teacherId === "string" && childData.teacherId.trim()
              ? childData.teacherId
              : assignedTeacherIds[0] || "";
        }
      } catch (e) {
        console.error("Failed to resolve teacherId for child:", childId, e);
      }
    }

    assignedTeacherIds = mergeTeacherIds(
      assignedTeacherIds,
      assignedTeacherId ? [assignedTeacherId] : undefined
    );

    // 2. Optimize and Obfuscate URL for database storage privacy as requested
    const optimizedUrl = cloudinaryService.optimizeUrl(videoUrl);
    const storedUrl = cloudinaryService.obfuscateUrl(optimizedUrl);

    const videoData: Omit<VideoMetadata, "id"> = {
      url: storedUrl, // Obfuscated
      senderId: metadata.senderId || "current-user-id",
      childId: childId,
      teacherId: assignedTeacherId, // Added for isolation
      teacherIds: assignedTeacherIds,
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

    const videoRef = collection(db, "video_modeling");

    const mapVideoDoc = (item: any) => {
      const data = item.data() as any;
      return {
        id: item.id,
        ...data,
        url: cloudinaryService.deobfuscateUrl(data.url)
      };
    };

    let list: any[] = [];

    // Apply filtering logic based on role
    if (role === "admin") {
      const snapshot = await getDocs(query(videoRef));
      list = snapshot.docs.map(mapVideoDoc);
    } else if (role === "parent" && childId) {
      const snapshot = await getDocs(query(videoRef, where("childId", "==", childId)));
      list = snapshot.docs.map(mapVideoDoc);
    } else if (role === "teacher" && userId) {
      const [teacherIdSnap, teacherIdsSnap, accessibleLearners] = await Promise.all([
        getDocs(query(videoRef, where("teacherId", "==", userId))),
        getDocs(query(videoRef, where("teacherIds", "array-contains", userId))),
        getLearnersForTeacher(userId, "teacher"),
      ]);

      const docsById = new Map<string, any>();
      for (const item of teacherIdSnap.docs) {
        docsById.set(item.id, item);
      }
      for (const item of teacherIdsSnap.docs) {
        docsById.set(item.id, item);
      }

      const learnerIds = Array.from(new Set(accessibleLearners.map((learner) => learner.id)));
      const batches: string[][] = [];
      for (let i = 0; i < learnerIds.length; i += 10) {
        batches.push(learnerIds.slice(i, i + 10));
      }

      const childSnapshots = await Promise.all(
        batches.map(async (batch) => {
          try {
            return await getDocs(query(videoRef, where("childId", "in", batch)));
          } catch (error) {
            console.warn("[VideoService] Failed to load videos by childId batch", { batch, error });
            return null;
          }
        })
      );

      for (const snap of childSnapshots) {
        if (!snap) continue;
        for (const item of snap.docs) {
          docsById.set(item.id, item);
        }
      }

      list = Array.from(docsById.values()).map(mapVideoDoc);
    } else {
      const snapshot = await getDocs(query(videoRef));
      list = snapshot.docs.map(mapVideoDoc);
    }

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
