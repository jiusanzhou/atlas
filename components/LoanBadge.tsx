"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import type { LoanBadgeInfo } from "@/lib/layout";
import type { ThemeTokens } from "@/lib/themes/types";

interface LoanBadgeProps {
  badges: LoanBadgeInfo[];
  theme: ThemeTokens;
}

/**
 * Loans are cross-diagram signals, so they are annotated on the card rather than
 * drawn as arrows — each top-level domain lives on its own tab / page.
 */
export function LoanBadge({ badges, theme }: LoanBadgeProps) {
  if (badges.length === 0) return null;

  return (
    <div className="absolute right-1 top-1 z-20 flex max-w-[85%] flex-col items-end gap-0.5">
      {badges.slice(0, 3).map((badge) => {
        const out = badge.direction === "out";
        return (
          <div
            key={`${badge.direction}-${badge.domain}`}
            className="flex max-w-full items-center gap-0.5 rounded px-1 py-[1px] text-[9px] font-bold leading-tight"
            style={{
              background: out ? theme.loanOutBackground : theme.loanInBackground,
              color: theme.loanBadgeText,
            }}
            title={
              out
                ? `借出到 ${badge.domain}${badge.role ? `：${badge.role}` : ""}`
                : `从 ${badge.domain} 借入${badge.role ? `：${badge.role}` : ""}`
            }
          >
            {out ? <ArrowRight size={9} strokeWidth={3} /> : <ArrowLeft size={9} strokeWidth={3} />}
            <span className="truncate">{badge.domain}</span>
            <span>{Math.round(badge.ratio * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default LoanBadge;
