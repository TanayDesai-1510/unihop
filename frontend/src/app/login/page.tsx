import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/LoginScreen";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="hero-surface flex-1" />}>
      <LoginScreen />
    </Suspense>
  );
}
