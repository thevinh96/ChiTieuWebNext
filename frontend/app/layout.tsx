import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChiTieuWeb — Tài chính nhẹ nhàng hơn",
  description: "Theo dõi thu chi và quản lý tài chính cá nhân đơn giản mỗi ngày.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
