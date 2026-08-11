"use client";

import { components } from "@les-chauffagistes/authentication-types";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { claimCoins, getBalance, getClaimable, getMe, logOut } from "../api";
import { config } from "@/lib/config";
import styles from "./page.module.css";
import { Coins } from "lucide-react";
import UnitConverter from "@/lib/UnitConverter";
import formatNumber from "@/lib/NumberFormatter";


export default function MyPage() {
  const [user, setUser] = useState<components["schemas"]["User"] | null | undefined>(undefined);
  const [claimable, setClaimable] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    getMe().then(setUser);
  }, []);

  useEffect(() => {
    if (!user) return;

    Promise.allSettled([getClaimable(), getBalance()]).then(([claimableResult, balanceResult]) => {
      setClaimable(claimableResult.status === "fulfilled" ? claimableResult.value : null);
      setUserBalance(balanceResult.status === "fulfilled" ? balanceResult.value : null);
    });
  }, [user]);

  // Turnstile only supports rendering widgets that already exist in the DOM. Since the widget
  // container is only mounted once the user is logged in, implicit rendering (scanning the DOM
  // on script load) doesn't work here: we render the widget explicitly once both the script and
  // the container are ready.
  useEffect(() => {
    if (!user || !turnstileReady || !turnstileContainerRef.current || turnstileWidgetId.current) return;

    turnstileWidgetId.current = window.turnstile!.render(turnstileContainerRef.current, {
      sitekey: config.TURNSTILE_SITE_KEY,
      callback: (token) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(null),
      "error-callback": () => setCaptchaToken(null),
    });

    return () => {
      if (turnstileWidgetId.current) {
        window.turnstile?.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [user, turnstileReady]);

  let claimButtonText = "Chargement...";
  if (claimable !== null) {
    claimButtonText = `Récupérer ${claimable} hashcoin${claimable > 1 ? "s" : ""}`;
  }

  return (
    <div className={styles.my}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onLoad={() => setTurnstileReady(true)}
      />
      {user === undefined && <p>Chargement...</p>}
      {user === null && <a href={`${config.AUTH_URL}/login?redirect=${globalThis.location.href}`}>Se connecter</a>}
      {user && <>
          <div style={{width: "100%"}}>
              <h1 style={{position: "absolute", left: "50%"}}>Yo {user.pseudo}</h1>
              <span><Coins/>{formatNumber(userBalance ?? 0)}</span>
          </div>
          <div ref={turnstileContainerRef}/>
          <button
              className="primary"
              disabled={!captchaToken || !claimable}
              onClick={() => {
                if (!captchaToken) return;
                claimCoins(captchaToken).then(() => {
                  setClaimable(0);
                  setCaptchaToken(null);
                  if (turnstileWidgetId.current) {
                    window.turnstile?.reset(turnstileWidgetId.current);
                  }
                  getBalance().then(setUserBalance).catch(_ => {});
                }).catch(_ => {
                });
              }}
          >{claimButtonText}</button>
          <button className="danger" onClick={() => {
            logOut().then(() => {
              setUser(null);
              globalThis.location.href = "/";
            });
          }}>Se d&eacute;connecter
          </button>
      </>
      }
    </div>
  );
}