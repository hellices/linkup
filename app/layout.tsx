// T004: Root layout with Auth provider + Azure Maps CSS
import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/app/lib/auth";
import "azure-maps-control/dist/atlas.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkUp — Map-First Collaboration",
  description: "3문장 포스트 + 지도 기반 탐색 + MCP 추천 + 협업 매칭",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="ko">
      <head>
        <script
          src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js"
          async
        />
      </head>
      <body className="h-screen w-screen overflow-hidden">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
