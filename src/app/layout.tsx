import type { Metadata } from "next";

import "./globals.css";
import DesktopNavbar from "./components/DesktopNavbar";


export const metadata: Metadata = {
  title: "Hash Contenders — Chauffagistes",
  description: "Entre dans la compétition et pose ta meilleure share. 👊🎤",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <div style={{
          display: "flex",
          height: "100dvh",
          overflow: "hidden"
        }}>
          <DesktopNavbar />
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
