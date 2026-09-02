"use client";

import { motion } from "framer-motion";
import type { LayoutResult, Slot } from "@/lib/layout";
import type { ThemeTokens } from "@/lib/themes/types";

interface LoanArrowProps {
  layout: LayoutResult;
  theme: ThemeTokens;
  still?: boolean;
}

function indexSlots(layout: LayoutResult): Map<string, Slot> {
  const index = new Map<string, Slot>();
  const walk = (boxes: LayoutResult["boxes"]) => {
    for (const box of boxes) {
      for (const slot of box.slots) index.set(slot.id, slot);
      walk(box.children);
    }
  };
  walk(layout.boxes);
  return index;
}

/**
 * SVG overlay drawing borrow relationships. Anchors on card edges using the
 * absolute coordinates from computeLayout, so no DOM measurement is needed.
 */
export function LoanArrow({ layout, theme, still = false }: LoanArrowProps) {
  const slots = indexSlots(layout);

  const paths = layout.edges.flatMap((edge) => {
    const source = edge.sourceSlotId ? slots.get(edge.sourceSlotId) : undefined;
    const target = edge.targetSlotId ? slots.get(edge.targetSlotId) : undefined;
    if (!source || !target) return [];

    const sx = source.x + source.width / 2;
    const sy = source.y + source.height;
    const tx = target.x + target.width / 2;
    const ty = target.y;

    // Bow the curve sideways so parallel loans stay distinguishable.
    const midY = (sy + ty) / 2;
    const bow = Math.min(160, Math.abs(ty - sy) * 0.35 + 40);
    const direction = tx >= sx ? 1 : -1;
    const d = `M ${sx} ${sy} C ${sx + direction * bow} ${midY}, ${tx - direction * bow} ${midY}, ${tx} ${ty}`;

    return [
      {
        id: `${edge.personId}-${edge.toDomain}`,
        d,
        label: `${edge.personName} · ${edge.role ?? "借调"} ${Math.round(edge.ratio * 100)}%`,
        labelX: (sx + tx) / 2,
        labelY: midY,
      },
    ];
  });

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-30"
      width={layout.width}
      height={layout.height}
      aria-hidden
    >
      <defs>
        <marker
          id="atlas-loan-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.loanArrow} />
        </marker>
      </defs>

      {paths.map((path, index) => (
        <g key={path.id}>
          <motion.path
            d={path.d}
            fill="none"
            stroke={theme.loanArrow}
            strokeWidth={2}
            strokeDasharray="7 5"
            markerEnd="url(#atlas-loan-arrow)"
            initial={still ? false : { pathLength: 0, opacity: 0 }}
            animate={still ? undefined : { pathLength: 1, opacity: 0.9 }}
            transition={{ duration: 0.9, delay: 0.25 + index * 0.15, ease: "easeInOut" }}
            opacity={still ? 0.9 : undefined}
          />
          <text
            x={path.labelX}
            y={path.labelY}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill={theme.loanBadgeText}
            stroke="rgba(0,0,0,0.75)"
            strokeWidth={3}
            paintOrder="stroke"
            style={{ fontFamily: theme.bodyFont }}
          >
            {path.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default LoanArrow;
