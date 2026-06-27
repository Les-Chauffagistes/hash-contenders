function getEnv(name: "API_URL" | "WSS_URL" | "BASE_URL" | "AUTH_API_URL" | "AUTH_URL"): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }

    return value.replace(/\/$/, "");
}

export const config = {
    get apiUrl() {
        return getEnv("API_URL");
    },
    get wssUrl() {
        return getEnv("WSS_URL");
    },
    get baseUrl() {
        return getEnv("BASE_URL");
    },
    get authApiUrl() {
        return getEnv("AUTH_API_URL");
    },
    get authUrl() {
        return getEnv("AUTH_URL");
    }
};
