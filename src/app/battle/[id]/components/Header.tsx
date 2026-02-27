
export default function Header({children}: {children: React.ReactNode}) {
    return (
        <div style={{display: "flex", flexDirection: "row", alignItems: "center", padding: 5, backgroundColor: "var(--browser-orange)"}}>
            {children}
        </div>
    )
}