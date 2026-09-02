"use client";

import { useMemo } from "react";
import type { Config, Domain } from "@/lib/schema";
import {
  computeDomainTreeLayout,
  layoutFromTheme,
  type TreeLink,
} from "@/lib/layout";
import { getTheme } from "@/lib/themes";
import { DomainCard } from "./DomainCard";
import { PersonCard } from "./PersonCard";
import { GapCard } from "./GapCard";

interface DomainTreeProps {
  config: Config;
  /** The top-level domain to draw. One tree per tab / drawio page / PNG. */
  domain: Domain;
  /** Static render for puppeteer: no entry/hover animation. */
  still?: boolean;
  columns?: number;
}

/** Vertical S-curve from a parent's bottom edge to a child's top edge. */
function linkPath(link: TreeLink): string {
  const midY = (link.fromY + link.toY) / 2;
  return `M ${link.fromX} ${link.fromY} C ${link.fromX} ${midY}, ${link.toX} ${midY}, ${link.toX} ${link.toY}`;
}

export function DomainTree({ config, domain, still = false, columns }: DomainTreeProps) {
  const theme = getTheme(config.theme);

  const layout = useMemo(
    () =>
      computeDomainTreeLayout(
        config,
        domain,
        layoutFromTheme(theme, columns ? { columns } : {}),
      ),
    [config, domain, theme, columns],
  );

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
      {/* Links sit under the nodes so connectors tuck behind the boxes. */}
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={layout.width}
        height={layout.height}
        aria-hidden
      >
        {layout.links.map((link) => (
          <path
            key={link.id}
            d={linkPath(link)}
            fill="none"
            stroke={theme.treeLink}
            strokeWidth={2}
          />
        ))}
      </svg>

      {layout.nodes.map((node) => (
        <DomainCard key={node.id} node={node} theme={theme}>
          {node.slots.map((slot) => (
            <div
              key={slot.id}
              className="absolute"
              style={{ left: slot.x - node.x, top: slot.y - node.y }}
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
    </div>
  );
}

export default DomainTree;
