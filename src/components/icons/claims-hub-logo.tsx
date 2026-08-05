"use client";

export function ClaimsHubLogo({ className }: { className?: string }) {
  const id = "claims-hub";
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3E8FF" />
          <stop offset="0.6" stopColor="#E9D5FF" />
          <stop offset="1" stopColor="#D8B4FE" />
        </linearGradient>
        <linearGradient id={`${id}-border`} x1="10" y1="8" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A855F7" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="20" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.85" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feOffset in="blur" dx="2" dy="1" result="offset" />
          <feFlood floodColor="#8B5CF6" floodOpacity="0.25" result="color" />
          <feComposite in="color" in2="offset" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="3" y="3" width="34" height="34" rx="12" fill={`url(#${id}-body)`} stroke="white" strokeOpacity="0.6" strokeWidth="1.2" />

      <path
        d="M8 9C11 6 29 6 32 9C34 11 34 14 32 16C29 12 11 12 8 16C6 14 6 11 8 9Z"
        fill={`url(#${id}-shine)`}
      />

      <path
        d="M20 11C22 11 24 11.5 26 12.3C27.5 12.9 28.5 14.2 28.5 15.8V21.5C28.5 24.5 25.5 27 20 29C14.5 27 11.5 24.5 11.5 21.5V15.8C11.5 14.2 12.5 12.9 14 12.3C16 11.5 18 11 20 11Z"
        fill="#8B5CF6"
        opacity="0.2"
        filter={`url(#${id}-soft)`}
        transform="translate(1.5, 1)"
      />

      <path
        d="M20 11C22 11 24 11.5 26 12.3C27.5 12.9 28.5 14.2 28.5 15.8V21.5C28.5 24.5 25.5 27 20 29C14.5 27 11.5 24.5 11.5 21.5V15.8C11.5 14.2 12.5 12.9 14 12.3C16 11.5 18 11 20 11Z"
        fill="white"
        opacity="0.9"
      />

      <path
        d="M20 11C22 11 24 11.5 26 12.3C27.5 12.9 28.5 14.2 28.5 15.8V21.5C28.5 24.5 25.5 27 20 29C14.5 27 11.5 24.5 11.5 21.5V15.8C11.5 14.2 12.5 12.9 14 12.3C16 11.5 18 11 20 11Z"
        stroke={`url(#${id}-border)`}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <path
        d="M17 21L19 23L24 18"
        stroke={`url(#${id}-border)`}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}