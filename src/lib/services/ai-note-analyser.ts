import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { Role } from "@/types/database";

// Potential medical/behavioral keywords to watch for
const WATCH_LIST = [
  "la hét", "vẫy tay", "đập đầu", "không nhìn", "nhắm mắt", 
  "lặp lại", "nói nhảm", "tức giận", "khóc", "cắn", 
  "chào hỏi", "tương tác", "chỉ tay", "giao tiếp mắt"
];

export const aiNoteAnalyser = {
  /**
   * Main analysis loop: called whenever a note is saved.
   * Extracts keywords and updates the NotePattern collection.
   */
  async analyzeNoteIteration(noteText: string, childId: string, noteId: string, role: Role) {
    if (!noteText) return;

    const lowerNote = noteText.toLowerCase();
    const foundKeywords = WATCH_LIST.filter(kw => lowerNote.includes(kw));

    for (const keyword of foundKeywords) {
      await this.updatePattern(childId, keyword, noteId, role);
    }
  },

  /**
   * Updates or creates a NotePattern for a specific keyword
   */
  async updatePattern(childId: string, keyword: string, noteId: string, role: Role) {
    const q = query(
      collection(db, "note_patterns"),
      where("childId", "==", childId),
      where("keyword", "==", keyword),
      where("isPromotedToTag", "==", false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Create new pattern
      await addDoc(collection(db, "note_patterns"), {
        childId,
        keyword,
        frequency: 1,
        sources: [{ noteId, role, timestamp: new Date() }],
        isPromotedToTag: false,
        suggestedAt: serverTimestamp()
      });
    } else {
      // Update existing pattern
      const patternDoc = snapshot.docs[0];
      const data = patternDoc.data();
      
      await updateDoc(doc(db, "note_patterns", patternDoc.id), {
        frequency: data.frequency + 1,
        sources: [...data.sources, { noteId, role, timestamp: new Date() }]
      });

      // Threshold check: Suggest tag if pattern repeats 3+ times
      if (data.frequency + 1 >= 3) {
        console.log(`[AI SYNC] Suggested New Tag Discovered: ${keyword} for child ${childId}`);
        // In a real app, this could trigger a push notification to the Teacher
      }
    }
  },

  /**
   * Fetch suggested tags for the UI
   */
  async getSuggestedTags(childId: string) {
    const q = query(
      collection(db, "note_patterns"),
      where("childId", "==", childId),
      where("isPromotedToTag", "==", false)
    );
    const snapshot = await getDocs(q);
    // Filter client-side to avoid composite index requirement
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(item => item.frequency >= 3);
  }
};
