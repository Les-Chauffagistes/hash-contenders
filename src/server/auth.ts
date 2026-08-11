import type {components} from "@les-chauffagistes/authentication-types";
import {jwtVerify} from "jose"
import {UnauthorizedError} from "@/lib/errors";
import {cookies} from "next/headers";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET)


export async function decodeAccessToken(token: string): Promise<components["schemas"]["User"]> {
    let decodedJwt;
    try {
        decodedJwt = await jwtVerify(token, SECRET, {
            algorithms: ["HS256"]
        })
    } catch (error) {
        console.log(error)
        throw new UnauthorizedError("Token expired")
    }
    const payload = decodedJwt.payload

    if (payload.type !== "access") {
        throw new Error("Invalid token type")
    }

    return {user_id: payload.sub, pseudo: payload.pseudo!} as components["schemas"]["User"]
}

/**
 * Ensure the user is logged in and returns the access token. The access token provided in the query must be valid.
 * Will raise an Unauthorized error is no valid token is provided.
 */
export async function extractAuthenticatedUser() {
    const cookieStore = await cookies();
    const access_token = cookieStore.get("access_token")?.value;
    console.log("token ending with", access_token?.slice(-5));
    if (!access_token) throw new UnauthorizedError("Token not found");
    const user = await decodeAccessToken(access_token);
    console.debug("current user:", user.pseudo)
    return {accessToken: access_token, user};
}

export async function extractUserAccessToken() {
    return (await extractAuthenticatedUser()).accessToken;
}
