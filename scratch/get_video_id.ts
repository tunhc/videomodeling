import { db } from "./src/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

async function getSampleVideoId() {
  const q = query(collection(db, "video_modeling"), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    console.log("VIDEO_ID:", snap.docs[0].id);
  } else {
    console.log("No videos found");
  }
}

getSampleVideoId();
