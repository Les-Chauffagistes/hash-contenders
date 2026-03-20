import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

function extractSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseSetCookie(setCookieValue: string) {
  const parts = setCookieValue.split(";").map((part) => part.trim());
  const [nameValue, ...attributes] = parts;

  const eqIndex = nameValue.indexOf("=");
  const name = nameValue.slice(0, eqIndex);
  const value = nameValue.slice(eqIndex + 1);

  const parsed: {
    name: string;
    value: string;
    path?: string;
    domain?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    maxAge?: number;
    expires?: Date;
  } = {
    name,
    value,
  };

  for (const attr of attributes) {
    const [rawKey, ...rawRest] = attr.split("=");
    const key = rawKey.toLowerCase();
    const attrValue = rawRest.join("=");

    if (key === "path") parsed.path = attrValue || "/";
    else if (key === "domain") parsed.domain = attrValue;
    else if (key === "httponly") parsed.httpOnly = true;
    else if (key === "secure") parsed.secure = true;
    else if (key === "samesite") {
      const normalized = attrValue.toLowerCase();
      if (normalized === "lax" || normalized === "strict" || normalized === "none") {
        parsed.sameSite = normalized;
      }
    } else if (key === "max-age") {
      const num = Number(attrValue);
      if (!Number.isNaN(num)) parsed.maxAge = num;
    } else if (key === "expires") {
      const date = new Date(attrValue);
      if (!Number.isNaN(date.getTime())) parsed.expires = date;
    }
  }

  return parsed;
}

export async function proxyAuthRequest(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const cookieStore = await cookies();
  const incomingCookieHeader = cookieStore.toString();

  const backendResponse = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(incomingCookieHeader ? { cookie: incomingCookieHeader } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const contentType = backendResponse.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const body = isJson ? await backendResponse.json() : null;

  const response = Response.json(body, {
    status: backendResponse.status,
  });

  const setCookies = extractSetCookieHeaders(backendResponse);

  for (const setCookie of setCookies) {
    const parsed = parseSetCookie(setCookie);

    cookieStore.set(parsed.name, parsed.value, {
      httpOnly: parsed.httpOnly,
      secure: parsed.secure,
      sameSite: parsed.sameSite,
      path: parsed.path ?? "/",
      domain: parsed.domain,
      maxAge: parsed.maxAge,
      expires: parsed.expires,
    });
  }

  return response;
}