"use client";

import { components } from "@les-chauffagistes/authentication-types";
import { useEffect, useState } from "react";
import { getMe, logOut } from "../api";
import {config} from "@/lib/config";


export default function MyPage() {
    const [user, setUser] = useState<components["schemas"]["User"] | null | undefined>(undefined);

    useEffect(() => {
        getMe().then(setUser);
    }, []);

    return (
        <div>
            {user === undefined && <p>Chargement...</p>}
            {user === null && <a href={`${config.AUTH_URL}/login?redirect=${globalThis.location.href}`}>Se connecter</a>}
            {user && <>
                <p>Yo {user.pseudo}</p>
                <button onClick={() => {
                    logOut().then(() => {
                        setUser(null);
                        globalThis.location.href = "/";
                    });
                }}>Se d&eacute;connecter</button>
            </>
            }
        </div>
    )
}