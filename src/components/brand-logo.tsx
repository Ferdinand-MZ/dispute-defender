import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={cn("h-9 w-9 shrink-0", className)}
    >
      <defs>
        <linearGradient id="dd-logo-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0079F2" />
          <stop offset="55%" stopColor="#0051B5" />
          <stop offset="100%" stopColor="#00297A" />
        </linearGradient>
        <linearGradient id="dd-logo-shield" x1="9" y1="6" x2="31" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CFE4FF" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#dd-logo-bg)" />
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="9"
        stroke="white"
        strokeOpacity="0.18"
      />
      <path
        d="M20 6.5L31 10.6V19.2C31 26.4 26.2 31.8 20 34C13.8 31.8 9 26.4 9 19.2V10.6L20 6.5Z"
        fill="url(#dd-logo-shield)"
        fillOpacity="0.15"
        stroke="url(#dd-logo-shield)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 14.2H24.5M15.5 17.8H21.2"
        stroke="#A6D0FF"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M15.2 22.8L18.5 26L25.2 19.2"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
