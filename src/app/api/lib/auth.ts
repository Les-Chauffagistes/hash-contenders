import {User} from "../../../../models/User";
import {jwtVerify} from "jose"
import {UnauthorizedError} from "@/app/api/lib/exceptions";
import {cookies} from "next/headers";
import {logger} from "@/lib/logger";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET)


export async function decodeAccessToken(token: string): Promise<User> {
    let decodedJwt;
    try {
        decodedJwt = await jwtVerify(token, SECRET, {
            algorithms: ["HS256"]
        })
    } catch (error) {
        logger.error(error)
        throw new UnauthorizedError("Token expired")
    }
    const payload = decodedJwt.payload

    if (payload.type !== "access") {
        throw new Error("Invalid token type")
    }

    return {user_id: payload.sub, pseudo: payload.pseudo!} as User
}

/**
 * Ensure the user is logged in and returns the access token. The access token provided in the query must be valid.
 * Will raise an Unauthorized error is no valid token is provided.
 */
export async function extractUserAccessToken() {
    const cookieStore = await cookies();
    const access_token = cookieStore.get("access_token")?.value;
    logger.info("token ending with", access_token?.slice(-5));
    if (!access_token) throw new UnauthorizedError("Token not found");
    const me = await decodeAccessToken(access_token);
    logger.debug("current user:", me.pseudo)
    if (!me) throw new UnauthorizedError("Token expired or invalid");
    return access_token;
}
