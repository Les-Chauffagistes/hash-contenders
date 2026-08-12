"use client";


import { HomeIcon, Tickets, UserCircle } from "lucide-react";
import styles from "./DesktopNavbar.module.css";
import { usePathname } from "next/navigation";
import Link from "next/link";


export default function DesktopNavbar() {
    const pathname = usePathname();

    return (
        <nav className={styles.desktopnavbar}>
            <ol>
                <li className={pathname === "/" ? styles.active : ""}>
                    <Link href="/">
                        <HomeIcon />
                        <p>Batailles</p>
                    </Link>
                </li>
                <li className={pathname.includes("/bets") ? styles.active : ""}>
                    <Link href="/bets">
                        <Tickets />
                        <p>Paris</p>
                    </Link>
                </li>
                <li className={pathname.includes("/my") ? styles.active : ""}>
                    <Link href="/my">
                        <UserCircle />
                        <p>Compte</p>
                    </Link>
                </li>
            </ol>
        </nav>
    )
}