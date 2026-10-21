import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Hash Contenders — Chauffagistes",
        short_name: "Hash Contenders",
        description: "Entre dans la compétition et pose ta meilleure share. 👊🎤",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#120d0a",
        theme_color: "#120d0a",
        icons: [
            {src: "/icons/icon-192.png", sizes: "192x192", type: "image/png"},
            {src: "/icons/icon-512.png", sizes: "512x512", type: "image/png"},
            {src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable"},
        ],
    };
}
