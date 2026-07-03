"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);
  return (
    <div className="auth-shell premium-bg-base">
      <div className="auth-card">
        <p className="auth-brand text-center">Claims Hub</p>
        <p className="auth-subtitle text-center mt-4">Redirigiendo...</p>
      </div>
    </div>
  );
}
