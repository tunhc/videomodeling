"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthSession, routeForSession } from "@/lib/auth-session";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    router.replace(routeForSession(session));
  }, [router]);

  return (
    <div className="min-h-screen bg-calm-gray flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
    </div>
  );
}
