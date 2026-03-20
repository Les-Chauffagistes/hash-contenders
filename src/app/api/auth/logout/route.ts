import { proxyAuthRequest } from "../_lib";

export async function POST() {
  return proxyAuthRequest("/v1/auth/logout", {
    method: "POST",
  });
}