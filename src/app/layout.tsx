import type { Metadata } from "next";
import "./globals.css";
import ImaoEffects from "@/components/ImaoEffects";
import ImaoHeader from "@/components/ImaoHeader";
import { Noto_Sans_KR } from "next/font/google";

const noto = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "IMAO",
  description: "피클볼의 시작, 그리고 즐거움의 끝!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={noto.variable}>
      <body>
        {/* FX layers */}
        <div className="cursor-glow" id="cursorGlow" />
        <div className="scroll-indicator" id="scrollIndicator" />
        <div className="bg-gradient" />

        <ImaoHeader />
        <ImaoEffects />

        {children}
      </body>
    </html>
  );
}
