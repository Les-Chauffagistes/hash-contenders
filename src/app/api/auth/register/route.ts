import { proxyAuthRequest } from "../_lib";

export async function POST(request: Request) {
  const body = await request.json();

  return proxyAuthRequest("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}