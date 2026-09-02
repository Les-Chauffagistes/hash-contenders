"use client";

import { useEffect, useState } from "react";
import { Round } from "../../../../../models/Hit";
import LogItem from "./LogItem";

/** Fréquence de rafraîchissement des "il y a X" affichés par LogItem. */
const TICK_INTERVAL_MS = 30_000;

export default function Log({hits}: {hits: Round[]}) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            {hits && hits.map(hit => <LogItem key={hit.block_height} hit={hit} now={now} />)}
        </div>
    )
}
