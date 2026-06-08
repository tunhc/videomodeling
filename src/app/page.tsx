"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function Home() {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "https://ai4autism-app.vercel.app/";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <Image 
          src="/icon.jpg" 
          alt="AI4Autism Logo" 
          width={150} 
          height={150} 
          className="rounded-3xl mx-auto shadow-lg"
          priority
        />
      </div>
      
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
        Hệ thống đã chuyển qua trang web mới
      </h1>
      
      <a 
        href="https://ai4autism-app.vercel.app/" 
        className="text-xl md:text-2xl text-blue-600 hover:text-blue-800 underline font-semibold mb-2 break-all transition-colors"
      >
        https://ai4autism-app.vercel.app/
      </a>
      
      <p className="text-gray-500 mb-8 font-medium animate-pulse">
        Hệ thống sẽ tự động chuyển hướng sau {countdown} giây...
      </p>
      
      <div className="space-y-3">
        <p className="text-lg md:text-xl text-gray-700 font-medium">
          Bạn có thể đăng nhập bằng tài khoản cũ.
        </p>
        
        <p className="text-base md:text-lg text-gray-500 italic mt-6">
          Xin lỗi quý phụ huynh và giáo viên vì sự bất tiện này.
        </p>
      </div>
    </div>
  );
}
