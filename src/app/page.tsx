"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if no session found
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/login");
    } else {
      const role = localStorage.getItem("userRole");
      if (role === "teacher") {
        router.push("/teacher");
      } else {
        router.push("/parent");
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-calm-gray flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
    </div>
  );
}
