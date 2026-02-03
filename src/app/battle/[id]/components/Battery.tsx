export default function Battery({ percent, alignment }: { percent: number, alignment: "start" | "end" }) {
    const baseBarStyle: React.CSSProperties = {
        width: 30,
        height: "100%",
        borderRadius: "3px",
        overflow: "hidden",
        //border: "solid 1px #3C836E"
    }
    return (
        <div>
            <div className="battery" style={{
                display: "flex",
                flexDirection: "row",
                alignContent: alignment,
                height: 90,
                alignItems: "center",
                justifyContent: "center",
                width: "fit-content"
            }}>
                <div style={{
                    border: "solid 1px #3C836E",
                    backgroundColor: "#1E2D28",
                    borderRadius: 8,
                    padding: 5,
                    boxShadow: "0px 0px 20px 1px rgba(60, 131, 110, 0.63)",
                    height: "100%"
                }}>
                    <div style={{ display: "flex", gap: 6, height: "100%" }}>
                        <div style={{ ...baseBarStyle, background: "linear-gradient(to bottom, #3C836E 0%, #57BBA1 70%, #4fb194 80%, #68DDC9 100%)", opacity: Math.min(1, Math.max(0, (percent) / 0.2)) }}></div>
                        <div style={{ ...baseBarStyle, background: "linear-gradient(to bottom, #3C836E 0%, #57BBA1 70%, #4fb194 80%, #68DDC9 100%)", opacity: Math.min(1, Math.max(0, (percent - 0.2) / 0.2)) }}></div>
                        <div style={{ ...baseBarStyle, background: "linear-gradient(to bottom, #3C836E 0%, #57BBA1 70%, #4fb194 80%, #68DDC9 100%)", opacity: Math.min(1, Math.max(0, (percent - 0.4) / 0.2)) }}></div>
                        <div style={{ ...baseBarStyle, background: "linear-gradient(to bottom, #3C836E 0%, #57BBA1 70%, #4fb194 80%, #68DDC9 100%)", opacity: Math.min(1, Math.max(0, (percent - 0.6) / 0.2)) }}></div>
                        <div style={{ ...baseBarStyle, background: "linear-gradient(to bottom, #3C836E 0%, #57BBA1 70%, #4fb194 80%, #68DDC9 100%)", opacity: Math.min(1, Math.max(0, (percent - 0.8) / 0.2)) }}></div>
                    </div>
                </div>
                <div style={{
                    border: "solid 1px #3C836E",
                    borderTopRightRadius: 6,
                    borderBottomRightRadius: 6,
                    overflow: "hidden",
                    margin: "auto 2px",
                    width: 6,
                    height: "40%",
                    backgroundColor: "#3C836E",

                }}></div>
            </div>
            <p style={{ textAlign: "center", marginTop: 20, width: "100%" }}>{Math.round(percent * 100)}%</p>
        </div>

    )
}