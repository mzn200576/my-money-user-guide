import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "내 돈 사용 설명서 | 투자전략 클래스랩",
  description: "실험경제, 역할별 자산배분, MPT와 위험진단을 연결한 투자전략 수업 플랫폼",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
