"use client";

export function ClaimsHubLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/claims-hub-mark.svg?v=2"
      alt="Claims Hub"
      className={className}
      role="img"
      aria-label="Claims Hub"
    />
  );
}
