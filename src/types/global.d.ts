interface Window {
  __CONFIG__: {
    API_URL: string
    WSS_URL: string
    BASE_URL: string
    AUTH_API_URL: string
    AUTH_URL: string
    BITCOIN_API_URL: string
    TURNSTILE_SITE_KEY: string
  };
  turnstile?: {
    render: (container: HTMLElement, options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
  };
}
