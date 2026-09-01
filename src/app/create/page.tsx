"use client";

import { useActionState, useEffect, useState } from "react";
import { createBattleAction } from "@/lib/actions/createBattle";
import { getBitcoinBlockHeight, getMe } from "@/app/api";
import { config } from "@/lib/config";
import { User } from "../../../models/User";
import { LogIn } from "lucide-react";
import styles from "./page.module.css";


export default function CreatePage() {
    const [state, action] = useActionState(createBattleAction, {});
    const [blockHeight, setBlockHeight] = useState<number | undefined>();
    const [user, setUser] = useState<User | null | undefined>(undefined);

    useEffect(() => {
        getBitcoinBlockHeight().then(h => setBlockHeight(h + 2));
        getMe()
            .then(setUser)
            .catch(error => {
                console.error("Impossible de vérifier la connexion", error);
                setUser(null);
            });
    }, []);

    const loginUrl = user === null
        ? `${config.AUTH_URL}/login?redirect=${encodeURIComponent(globalThis.location.href)}`
        : "";

    return (
        <form action={action} className={styles.create}>
            <h1 className={styles.title}>Nouvelle bataille</h1>

            {user === null && (
                <div className={styles.authNotice} role="alert">
                    <LogIn aria-hidden="true" size={20} />
                    <div>
                        <p className={styles.authNoticeTitle}>Connexion requise</p>
                        <p>
                            Vous devez être connecté pour créer une bataille.
                        </p>
                        <a href={loginUrl} className={styles.loginLink}>Se connecter</a>
                    </div>
                </div>
            )}

            {state?.errors?._form && (
                <p className={styles.formError} role="alert">{state.errors._form}</p>
            )}

            <label className={styles.checkboxField}>
                <input type="checkbox" name="are_addresses_privates" />
                <span>Masquer les adresses des contenders</span>
            </label>

            <fieldset className={styles.fieldset}>
                <legend>Contender 1</legend>
                <div className={styles.field}>
                    <label htmlFor="contender_1_address">Adresse</label>
                    <input type="text" id="contender_1_address" name="contender_1_address" placeholder="bc1..."/>
                    {state?.errors?.contender_1_address && (
                        <p className={styles.errorLabel}>{state.errors.contender_1_address}</p>
                    )}
                </div>
                <div className={styles.field}>
                    <label htmlFor="contender_1_name">Nom</label>
                    <input type="text" id="contender_1_name" name="contender_1_name" placeholder="Heatman"/>
                    {state?.errors?.contender_1_name && (
                        <p className={styles.errorLabel}>{state.errors.contender_1_name}</p>
                    )}
                </div>
                <div className={styles.field}>
                    <label htmlFor="contender_1_worker">Mineur ciblé (optionnel)</label>
                    <input type="text" id="contender_1_worker" name="contender_1_worker"
                           placeholder="Laisser vide pour affronter toute la pool"/>
                </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend>Contender 2</legend>
                <div className={styles.field}>
                    <label htmlFor="contender_2_address">Adresse</label>
                    <input type="text" id="contender_2_address" name="contender_2_address" placeholder="bc1..."/>
                    {state?.errors?.contender_2_address && (
                        <p className={styles.errorLabel}>{state.errors.contender_2_address}</p>
                    )}
                </div>
                <div className={styles.field}>
                    <label htmlFor="contender_2_name">Nom</label>
                    <input type="text" id="contender_2_name" name="contender_2_name" placeholder="Boilman"/>
                    {state?.errors?.contender_2_name && (
                        <p className={styles.errorLabel}>{state.errors.contender_2_name}</p>
                    )}
                </div>
                <div className={styles.field}>
                    <label htmlFor="contender_2_worker">Mineur ciblé (optionnel)</label>
                    <input type="text" id="contender_2_worker" name="contender_2_worker"
                           placeholder="Laisser vide pour affronter toute la pool"/>
                </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend>Paramètres</legend>
                <div className={styles.field}>
                    <label htmlFor="contenders_pv">PV des contenders</label>
                    <input type="number" id="contenders_pv"
                    name="contenders_pv" placeholder="20"/>
                    {state?.errors?.contenders_pv && (
                        <p className={styles.errorLabel}>{state.errors.contenders_pv}</p>
                    )}
                </div>
                <div className={styles.field}>
                    <label htmlFor="rounds">Nombre de rounds</label>
                    <input type="number" id="rounds"
                    name="rounds" placeholder="40"/>
                    {state?.errors?.rounds && (
                        <p className={styles.errorLabel}>{state.errors.rounds}</p>
                    )}
                </div>
                <div className={styles.field}>
                    <label htmlFor="start_height">Hauteur du bloc de départ</label>
                    <input type="number" id="start_height"
                    name="start_height" defaultValue={blockHeight}/>
                    {state?.errors?.start_height && (
                        <p className={styles.errorLabel}>{state.errors.start_height}</p>
                    )}
                </div>
            </fieldset>

            <button type="submit" className={styles.submitButton}>Créer la bataille</button>
        </form>
    )
}