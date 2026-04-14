import Link from "next/link";

export default function UnsupportedBrowserPage() {
  return (
    <main className="min-h-screen bg-calm-gray flex items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-8 shadow-soft space-y-5">
        <p className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-700">
          Browser Compatibility
        </p>

        <h1 className="text-2xl font-black text-gray-900 leading-tight">
          Thiết bị hiện tại chưa tương thích hoàn toàn
        </h1>

        <p className="text-sm font-medium text-gray-600 leading-relaxed">
          Hệ thống đang chạy với nền tảng web mới. Một số thiết bị iOS cũ như iPhone 7/7 Plus
          có thể không mở được giao diện đầy đủ.
        </p>

        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
          <li>Cập nhật iOS/Safari lên phiên bản mới nhất có thể.</li>
          <li>Thử mở trang trên thiết bị mới hơn (iOS 16.4+).</li>
          <li>Nếu vẫn cần thử tiếp trên máy này, bấm nút bên dưới.</li>
        </ul>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-black text-white"
          >
            Quay lại đăng nhập
          </Link>
          <Link
            href="/?compat=allow"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700"
          >
            Vẫn thử tiếp trên thiết bị này
          </Link>
        </div>
      </section>
    </main>
  );
}
