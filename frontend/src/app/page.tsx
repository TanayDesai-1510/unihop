"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor } from "@/components/app/SessionProvider";
import { Logo } from "@/components/brand/Logo";
import { api, getToken } from "@/lib/api";

/** Entry: route signed-in users to their mode's home, everyone else to login. Looks like the splash. */
export default function Entry() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api
      .getMe()
      .then((u) => router.replace(homeFor(u.mode)))
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center bg-brand-logo">
      <Logo variant="mark" onBrand size={112} priority />
    </main>
  );
}
