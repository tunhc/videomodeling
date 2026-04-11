import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  Unsubscribe
} from "firebase/firestore";

export interface CollaborationTask {
  id?: string;
  teacherId: string;
  teacherName: string;
  childId: string;
  parentId: string;
  content: string;
  status: "unread" | "read" | "acknowledged";
  type: "instruction";
  createdAt?: any;
}

/**
 * Teacher sends a task/instruction to parent.
 * Writes to 'collaboration_tasks' collection.
 */
export async function sendInstruction(task: Omit<CollaborationTask, "id" | "createdAt" | "status">) {
  return addDoc(collection(db, "collaboration_tasks"), {
    ...task,
    status: "unread",
    createdAt: serverTimestamp(),
  });
}

/**
 * Real-time listener for parent's dashboard.
 * Calls onNewTasks() whenever new unread tasks arrive.
 */
export function subscribeToTasks(childId: string, onNewTasks: (tasks: CollaborationTask[]) => void): Unsubscribe {
  const q = query(
    collection(db, "collaboration_tasks"),
    where("childId", "==", childId),
    where("status", "==", "unread")
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CollaborationTask));
    onNewTasks(tasks);
  });
}

/**
 * Mark a task as acknowledged by parent.
 */
export async function acknowledgeTask(taskId: string) {
  return updateDoc(doc(db, "collaboration_tasks", taskId), { status: "acknowledged" });
}
