"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { getAllBattles } from "./api";
import BattleCard from "./components/BattleCard";
import { Battle } from "../../models/Battle";
import Link from "next/link";

export default function Home() {
  const [battles, setBattles] = useState<Battle[] | null>(null);

  useEffect(() => {
    getAllBattles().then(data => setBattles(data));
  }, []);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {
          battles === null ?
            "Ça va chauffer..." :
            battles.length === 0 ?
              "Aucune bataille en cours" :
              battles.map(battle =>
              <Link href={`/battle/${battle.id}`} key={battle.id}>
                <BattleCard battle={battle} />
              </Link>)}
      </main>
    </div>
  );
}