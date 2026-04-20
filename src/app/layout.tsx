import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const lexend = Lexend({
  subsets: ["latin", "vietnamese"],
  variable: "--font-lexend",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI4Autism - Video Modeling",
  description: "Hyper-personalized Digital Twin (hpDT) for Autism Support",
  icons: {
    icon: "/icon.jpg",
    apple: "/icon.jpg",
  },
};

const LEGACY_BROWSER_GUARD = `
(function () {
  try {
    var path = window.location.pathname || "";
    var query = window.location.search || "";
    if (path.indexOf("/unsupported-browser") === 0) return;
    if (query.indexOf("compat=allow") !== -1) return;

    var ua = navigator.userAgent || "";
    var iosMatch = ua.match(/OS (\\d+)_/);
    var iosMajor = iosMatch ? parseInt(iosMatch[1], 10) : null;

    var safariMatch = ua.match(/Version\\/(\\d+)\\.(\\d+)/);
    var safariMajor = safariMatch ? parseInt(safariMatch[1], 10) : null;
    var safariMinor = safariMatch ? parseInt(safariMatch[2], 10) : null;

    var isAppleWebKit = /AppleWebKit/i.test(ua);
    var isOldIOS = iosMajor !== null && iosMajor < 16;
    var isOldSafari =
      safariMajor !== null && (safariMajor < 16 || (safariMajor === 16 && safariMinor < 4));

    if (isAppleWebKit && (isOldIOS || isOldSafari)) {
      var target = "/unsupported-browser?from=" + encodeURIComponent(path);
      window.location.replace(target);
    }
  } catch (error) {
    // Keep app usable even if detection fails.
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${lexend.variable} h-full antialiased font-lexend`}
      suppressHydrationWarning
    >
      <body 
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <Script id="legacy-browser-guard" strategy="beforeInteractive">
          {LEGACY_BROWSER_GUARD}
        </Script>
        {children}
      </body>
    </html>
  );
}
