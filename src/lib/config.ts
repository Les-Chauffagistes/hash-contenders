export const config = {
    get BASE_URL() {
        return typeof window !== "undefined"
            ? (window.__CONFIG__?.BASE_URL ?? "")
            : (process.env.BASE_URL ?? "");
    },
    get AUTH_URL() {
        return typeof window !== "undefined"
            ? (window.__CONFIG__?.AUTH_URL ?? "")
            : (process.env.AUTH_URL ?? "");
    },
    get API_URL() {
        return typeof window !== "undefined"
            ? (window.__CONFIG__?.API_URL ?? "")
            : (process.env.API_URL ?? "");
    },
    get AUTH_API_URL() {
        return typeof window !== "undefined"
            ? (window.__CONFIG__?.AUTH_API_URL ?? "")
            : (process.env.AUTH_API_URL ?? "");
    },
    get WSS_URL() {
        return typeof window !== "undefined"
            ? (window.__CONFIG__?.WSS_URL ?? "")
            : (process.env.WSS_URL ?? "");
    },
    get BITCOIN_API_URL() {
        return typeof window !== "undefined"
            ? (window.__CONFIG__?.BITCOIN_API_URL ?? "")
            : (process.env.BITCOIN_API_URL ?? "");
    }
};
