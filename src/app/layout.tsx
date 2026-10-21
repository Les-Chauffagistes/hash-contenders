import type {Metadata, Viewport} from "next";

import "./globals.css";
import DesktopNavbar from "./components/DesktopNavbar";
import styles from "./layout.module.css";
import React from "react";


export const metadata: Metadata = {
    title: "Hash Contenders — Chauffagistes",
    description: "Entre dans la compétition et pose ta meilleure share. 👊🎤",
    icons: {
        icon: [
            {url: "/icons/icon-16.png", sizes: "16x16", type: "image/png"},
            {url: "/icons/icon-32.png", sizes: "32x32", type: "image/png"},
            {url: "/icons/icon-64.png", sizes: "64x64", type: "image/png"},
            {url: "/icons/icon-256.png", sizes: "256x256", type: "image/png"},
        ],
        apple: [{url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png"}],
    },
    appleWebApp: {
        capable: true,
        title: "Hash Contenders",
        statusBarStyle: "black-translucent",
    },
};

export const viewport: Viewport = {
    themeColor: "#120d0a",
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
