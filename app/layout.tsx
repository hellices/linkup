// T004: Root layout with Auth provider + Azure Maps CSS
import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import { auth } from "@/app/lib/auth";
import "azure-maps-control/dist/atlas.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkUp — Map-First Collaboration",
  description: "3-sentence posts + map-based discovery + MCP recommendations + collaboration matching",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <head>
        <script
          src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js"
          async
        />
      </head>
      <body className="h-screen w-screen overflow-hidden">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
