import type {Metadata} from "next";

import "./globals.css";
import DesktopNavbar from "./components/DesktopNavbar";
import styles from "./layout.module.css";
import React from "react";


export const metadata: Metadata = {
    title: "Hash Contenders — Chauffagistes",
    description: "Entre dans la compétition et pose ta meilleure share. 👊🎤",
};

export default function RootLayout({children,}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="fr">
        <head>
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="/config.js"/>
        </head>
        <body>
        <div className={styles.shell}>
            <DesktopNavbar/>
            <div className={styles.content}>
                {children}
            </div>
        </div>
        </body>
        </html>
    );
}
