"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Config, Domain } from "@/lib/schema";
import {
  computeDomainTreeLayout,
  layoutFromTheme,
  type LoanLink,
  type Slot,
  type TreeLink,
} from "@/lib/layout";
import { getTheme } from "@/lib/themes";
import { DomainCard } from "./DomainCard";
import { PersonCard } from "./PersonCard";
import { GapCard } from "./GapCard";
import { MinimalCard } from "./MinimalCard";
import { PersonHoverPanel, pickPanelSide, type PanelSide } from "./PersonHoverPanel";
import { NO_PAN_ATTR } from "./Canvas";

interface DomainTreeProps {
  config: Config;
  /** The top-level domain to draw. One tree per tab / drawio page / PNG. */
  domain: Domain;
  /** Static render for puppeteer: no entry/hover animation, no hover panel. */
  still?: boolean;
  /** Drop the theme backdrop so a host canvas can show its own grid through. */
  transparent?: boolean;
  columns?: number;
}

/** Grace period so moving the pointer card -> panel does not close it. */
const CLOSE_DELAY_MS = 250;

interface PanelState {
  slotId: string;
  side: PanelSide;
  pinned: boolean;
  /** Identifies the tree the panel was opened against, so a theme or domain
   *  switch invalidates it by derivation instead of an effect-driven reset. */
  treeKey: string;
}

/** Vertical S-curve from a parent's bottom edge to a child's top edge. */
function linkPath(link: TreeLink): string {
  const midY = (link.fromY + link.toY) / 2;
  return `M ${link.fromX} ${link.fromY} C ${link.fromX} ${midY}, ${link.toX} ${midY}, ${link.toX} ${link.toY}`;
}

/** Loan arrows bow sideways so they read as an aside, not a tree edge. */
function loanPath(link: LoanLink): string {
  const midX = (link.fromX + link.toX) / 2;
  const midY = (link.fromY + link.toY) / 2;
  const dx = link.toX - link.fromX;
  const dy = link.toY - link.fromY;
  const length = Math.hypot(dx, dy) || 1;
  const bow = Math.min(60, length * 0.22);
  // Perpendicular offset of the control point.
  const cx = midX + (-dy / length) * bow;
  const cy = midY + (dx / length) * bow;
  return `M ${link.fromX} ${link.fromY} Q ${cx} ${cy} ${link.toX} ${link.toY}`;
}

export function DomainTree({
  config,
  domain,
  still = false,
  transparent = false,
  columns,
}: DomainTreeProps) {
  const theme = getTheme(config.theme);
  const isMinimal = theme.variant === "minimal";

  const layout = useMemo(
    () =>
      computeDomainTreeLayout(
        config,
        domain,
        layoutFromTheme(theme, columns ? { columns } : {}),
      ),
    [config, domain, theme, columns],
  );

  const treeKey = `${domain.name}::${theme.name}`;
  const [panelState, setPanel] = useState<PanelState | null>(null);
  // Derived rather than effect-reset: a panel from a previous theme/domain is
  // simply not the current tree's panel.
  const panel = panelState?.treeKey === treeKey ? panelState : null;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current === null) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setPanel((current) => (current?.pinned ? current : null));
    }, CLOSE_DELAY_MS);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  const openPanel = useCallback(
    (slotId: string, element: HTMLElement) => {
      cancelClose();
      const side = pickPanelSide(element.getBoundingClientRect(), currentScale(element));
      setPanel((current) =>
        // Keep a pinned panel pinned when the pointer merely re-enters its card.
        current?.slotId === slotId && current.treeKey === treeKey
          ? { ...current, side }
          : { slotId, side, pinned: false, treeKey },
      );
    },
    [cancelClose, treeKey],
  );

  const togglePin = useCallback(
    (slotId: string, element: HTMLElement) => {
      cancelClose();
      const side = pickPanelSide(element.getBoundingClientRect(), currentScale(element));
      setPanel((current) =>
        current?.slotId === slotId && current.treeKey === treeKey && current.pinned
          ? null
          : { slotId, side, pinned: true, treeKey },
      );
    },
    [cancelClose, treeKey],
  );

  // Clicking empty canvas or pressing Esc releases a pinned panel.
  useEffect(() => {
    if (!panel?.pinned) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-minimal-card]") || target.closest("[data-person-panel]")) return;
      setPanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panel?.pinned]);

  const slotsById = useMemo(() => {
    const map = new Map<string, Slot>();
    for (const node of layout.nodes) {
      for (const slot of node.slots) map.set(slot.id, slot);
    }
    return map;
  }, [layout]);

  const activeSlot = panel ? slotsById.get(panel.slotId) : undefined;
  const showLoanArrows = theme.showLoanArrows && layout.loanLinks.length > 0;

  return (
    <div
      id="atlas-canvas"
      // Interactive trees must let the hover panel spill past the tree bounds;
      // the `still` export surface keeps clipping so PNGs stay exactly sized.
      className={`relative ${still ? "overflow-hidden" : ""}`}
      style={{
        width: layout.width,
        height: layout.height,
        background: transparent ? undefined : theme.canvasBackground,
      }}
    >
      {/* Links sit under the nodes so connectors tuck behind the boxes. */}
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={layout.width}
        height={layout.height}
        aria-hidden
      >
        {showLoanArrows && (
          <defs>
            <marker
              id="atlas-loan-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.loanArrow} />
            </marker>
          </defs>
        )}

        {layout.links.map((link) => (
          <path
            key={link.id}
            d={linkPath(link)}
            fill="none"
            stroke={theme.treeLink}
            strokeWidth={2}
          />
        ))}

        {/* Same-tree loans only; cross-tree ones stay corner badges. */}
        {showLoanArrows &&
          layout.loanLinks.map((link) => (
            <path
              key={link.id}
              data-loan-link={link.id}
              d={loanPath(link)}
              fill="none"
              stroke={theme.loanArrow}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              markerEnd="url(#atlas-loan-arrow)"
            />
          ))}
      </svg>

      {layout.nodes.map((node) => (
        <DomainCard key={node.id} node={node} theme={theme}>
          {node.slots.map((slot) => (
            <div
              key={slot.id}
              // Cards own their pointer gestures; the canvas pans on empty space.
              {...{ [NO_PAN_ATTR]: true }}
              className="absolute cursor-default"
              style={{ left: slot.x - node.x, top: slot.y - node.y }}
              {...(isMinimal && !still
                ? {
                    onPointerEnter: (event) => openPanel(slot.id, event.currentTarget),
                    onPointerLeave: scheduleClose,
                    onClick: (event) => togglePin(slot.id, event.currentTarget),
                  }
                : {})}
            >
              {isMinimal ? (
                <MinimalCard
                  slot={slot}
                  theme={theme}
                  still={still}
                  active={panel?.slotId === slot.id}
                />
              ) : slot.kind === "gap" ? (
                <GapCard slot={slot} theme={theme} still={still} />
              ) : (
                <PersonCard slot={slot} theme={theme} still={still} />
              )}
            </div>
          ))}
        </DomainCard>
      ))}

      {/* Panel lives above every domain box, in the same world coordinates. */}
      {activeSlot && panel && (
        <div {...{ [NO_PAN_ATTR]: true }} className="pointer-events-none absolute inset-0 z-50">
          <PersonHoverPanel
            slot={activeSlot}
            theme={theme}
            side={panel.side}
            pinned={panel.pinned}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          />
        </div>
      )}
    </div>
  );
}

/** Live canvas zoom, read off the transformed ancestor layer. */
function currentScale(element: HTMLElement): number {
  const layer = element.closest<HTMLElement>("[data-canvas-layer]");
  if (!layer) return 1;
  const matrix = new DOMMatrix(getComputedStyle(layer).transform);
  return matrix.a || 1;
}

export default DomainTree;
