import React from "react";

export default function Header({children}: Readonly<{ children: React.ReactNode }>) {
    return (
        <div style={{display: "flex", flexDirection: "row", alignItems: "center", padding: 5, backgroundColor: "var(--browser-orange)"}}>
            {children}
        </div>
    )
}