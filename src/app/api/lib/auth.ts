import { components } from "@les-chauffagistes/authentication-types";
import { jwtVerify } from "jose"


const SECRET = new TextEncoder().encode(process.env.JWT_SECRET)


export async function decodeAccessToken(token: string): Promise<components["schemas"]["User"]> {
    const { payload } = await jwtVerify(token, SECRET, {
        algorithms: ["HS256"]
    })

    if (payload.type !== "access") {
        throw new Error("Invalid token type")
    }

    return { user_id: payload.sub, pseudo: payload.pseudo! } as components["schemas"]["User"]
}