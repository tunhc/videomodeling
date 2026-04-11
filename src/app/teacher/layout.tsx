"use client";

import BottomNav from "@/components/layout/BottomNav";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-calming-bg font-lexend">
      <main className="pb-20">
        {children}
      </main>
      <BottomNav role="teacher" />
    </div>
  );
}
