"use client";

import { useMemo } from "react";
import type { Config } from "@/lib/schema";
import { computeLayout, layoutFromTheme, type DomainBox } from "@/lib/layout";
import { getTheme } from "@/lib/themes";
import { DomainCard } from "./DomainCard";
import { PersonCard } from "./PersonCard";
import { GapCard } from "./GapCard";
import { LoanArrow } from "./LoanArrow";

interface DomainTreeProps {
  config: Config;
  /** Static render for puppeteer: no entry/hover animation. */
  still?: boolean;
  columns?: number;
}

/**
 * computeLayout returns canvas-absolute coordinates, so boxes are rendered as a
 * flat list rather than DOM-nested (nesting would offset children twice).
 * Deeper boxes come later and paint above their parent.
 */
function flatten(boxes: DomainBox[]): DomainBox[] {
  const out: DomainBox[] = [];
  const walk = (list: DomainBox[]) => {
    for (const box of list) {
      out.push(box);
      walk(box.children);
    }
  };
  walk(boxes);
  return out.sort((a, b) => a.depth - b.depth);
}

export function DomainTree({ config, still = false, columns }: DomainTreeProps) {
  const theme = getTheme(config.theme);

  const layout = useMemo(
    () => computeLayout(config, layoutFromTheme(theme, columns ? { columns } : {})),
    [config, theme, columns],
  );

  const boxes = useMemo(() => flatten(layout.boxes), [layout]);

  return (
    <div
      id="atlas-canvas"
      className="relative overflow-hidden"
      style={{
        width: layout.width,
        height: layout.height,
        background: theme.canvasBackground,
      }}
    >
      {boxes.map((box) => (
        <DomainCard key={box.id} box={box} theme={theme}>
          {box.slots.map((slot) => (
            <div
              key={slot.id}
              className="absolute"
              style={{ left: slot.x - box.x, top: slot.y - box.y }}
            >
              {slot.kind === "gap" ? (
                <GapCard slot={slot} theme={theme} still={still} />
              ) : (
                <PersonCard slot={slot} theme={theme} still={still} />
              )}
            </div>
          ))}
        </DomainCard>
      ))}

      <LoanArrow layout={layout} theme={theme} still={still} />
    </div>
  );
}

export default DomainTree;
