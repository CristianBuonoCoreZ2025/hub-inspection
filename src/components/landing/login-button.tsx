"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface LoginButtonProps {
  children: ReactNode;
  className?: string;
  showArrow?: boolean;
}

export function LoginButton({ children, className, showArrow = false }: LoginButtonProps) {
  return (
    <Button
      className={cn("pg-btn-platinum", className)}
      onClick={() => {
        window.location.href = "/login";
      }}
    >
      {children}
      {showArrow && <ArrowRight className="ml-1.5 size-3.5" />}
    </Button>
  );
}
