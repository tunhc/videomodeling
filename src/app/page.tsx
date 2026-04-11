"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Force redirect to login from root to avoid stale session confusion
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-calm-gray flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
    </div>
  );
}
