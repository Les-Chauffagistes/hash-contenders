"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthUser, getCurrentUser } from "../api";

type Props = {
  children: ReactNode;
  adminOnly?: boolean;
};

export default function RequireAuth({ children, adminOnly = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        if (adminOnly && u.role !== "ADMIN") {
          router.replace("/account");
          return;
        }

        setUser(u);
      })
      .catch(() => {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      })
      .finally(() => setLoading(false));
  }, [adminOnly, pathname, router]);

  if (loading) {
    return <div style={{ padding: "2rem" }}>Chargement...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}