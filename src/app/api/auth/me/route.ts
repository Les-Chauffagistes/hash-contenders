import { proxyAuthRequest } from "../_lib";

export async function GET() {
  return proxyAuthRequest("/v1/auth/me", {
    method: "GET",
  });
}