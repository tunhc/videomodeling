import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const db = getAdminDb();
    
    const analysisSnap = await db.collection("video_analysis").get();
      
    const batch = db.batch();
    
    // Delete all analyses
    analysisSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Reset all videos
    const videosSnap = await db.collection("video_modeling").where("status", "==", "Đã phân tích").get();
    const resetCount = videosSnap.size;
    
    videosSnap.forEach(doc => {
      batch.update(doc.ref, { status: "pending" });
    });
    
    await batch.commit();
    
    return NextResponse.json({ 
      success: true, 
      message: `Đã xóa ${analysisSnap.size} kết quả phân tích cũ và reset ${resetCount} videos về trạng thái pending.` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
