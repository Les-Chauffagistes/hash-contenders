import type { Metadata } from "next";

import "./globals.css";


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
        {children}
      </body>
    </html>
  );
}
