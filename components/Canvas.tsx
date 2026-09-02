"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Crosshair, Maximize2, Minus, Plus } from "lucide-react";

/**
 * Elements carrying this attribute swallow pan gestures so they stay
 * interactive (hover, click). Holding space overrides it.
 */
export const NO_PAN_ATTR = "data-canvas-no-pan";

export type GridBackground = "dots" | "lines" | "none";

export interface CanvasHandle {
  /** Centre the content in the viewport with a small padding margin. */
  fitToContent: () => void;
  /** Back to 1×, content top-centred. */
  reset: () => void;
  zoomBy: (factor: number) => void;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface CanvasProps {
  children: ReactNode;
  ref?: RefObject<CanvasHandle | null>;
  minZoom?: number;
  maxZoom?: number;
  /** Fit once the content has been measured. */
  initialFit?: boolean;
  /** Changing this re-runs the initial fit (e.g. the active domain name). */
  fitKey?: string | number;
  gridBackground?: GridBackground;
  /** Base colour behind the grid. */
  background?: string;
  /** Fraction of the viewport kept empty around the content when fitting. */
  fitPadding?: number;
  className?: string;
}

const GRID_SIZE = 24;
const IDENTITY: ViewState = { x: 0, y: 0, scale: 1 };

function gridImage(kind: GridBackground): string | undefined {
  if (kind === "dots") {
    return "radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)";
  }
  if (kind === "lines") {
    return [
      "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)",
      "linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
    ].join(", ");
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Pan is suppressed over opted-out subtrees so cards keep their own gestures. */
function isNoPanTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${NO_PAN_ATTR}]`) !== null;
}

/**
 * Infinite pannable / zoomable viewport. Children are laid out in world
 * coordinates inside a single transformed layer, so a tree far bigger than the
 * viewport costs nothing extra to move around.
 */
export function Canvas({
  children,
  ref,
  minZoom = 0.2,
  maxZoom = 3,
  initialFit = false,
  fitKey,
  gridBackground = "dots",
  background = "#111113",
  fitPadding = 0.05,
  className,
}: CanvasProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewState>(IDENTITY);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  /** Set when a fit is owed but the content has not been measured yet. */
  const pendingFit = useRef(initialFit);
  const panOrigin = useRef<{ pointerX: number; pointerY: number; view: ViewState } | null>(null);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return null;
    const width = content.offsetWidth;
    const height = content.offsetHeight;
    if (width === 0 || height === 0) return null;
    return { viewport, width, height };
  }, []);

  const fitToContent = useCallback(() => {
    const measured = measure();
    if (!measured) {
      pendingFit.current = true;
      return;
    }
    const { viewport, width, height } = measured;
    const usable = 1 - fitPadding * 2;
    const scale = clamp(
      Math.min((viewport.clientWidth * usable) / width, (viewport.clientHeight * usable) / height),
      minZoom,
      // Never magnify a small tree past 1:1; zooming in stays a user choice.
      Math.min(maxZoom, 1),
    );
    pendingFit.current = false;
    setView({
      x: (viewport.clientWidth - width * scale) / 2,
      y: (viewport.clientHeight - height * scale) / 2,
      scale,
    });
  }, [measure, fitPadding, minZoom, maxZoom]);

  const reset = useCallback(() => {
    const measured = measure();
    if (!measured) {
      setView(IDENTITY);
      return;
    }
    const { viewport, width } = measured;
    setView({ x: (viewport.clientWidth - width) / 2, y: 24, scale: 1 });
  }, [measure]);

  /** Zoom keeping the given viewport-relative point pinned under the cursor. */
  const zoomAt = useCallback(
    (factor: number, pivotX: number, pivotY: number) => {
      setView((current) => {
        const scale = clamp(current.scale * factor, minZoom, maxZoom);
        if (scale === current.scale) return current;
        const ratio = scale / current.scale;
        return {
          scale,
          x: pivotX - (pivotX - current.x) * ratio,
          y: pivotY - (pivotY - current.y) * ratio,
        };
      });
    },
    [minZoom, maxZoom],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      zoomAt(factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
    },
    [zoomAt],
  );

  useImperativeHandle(ref, () => ({ fitToContent, reset, zoomBy }), [fitToContent, reset, zoomBy]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Middle-drag pans anywhere; left-drag only over empty canvas.
      const wantsPan =
        event.button === 1 || spaceHeld || (event.button === 0 && !isNoPanTarget(event.target));
      if (!wantsPan) return;

      panOrigin.current = { pointerX: event.clientX, pointerY: event.clientY, view };
      setPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [spaceHeld, view],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = panOrigin.current;
    if (!origin) return;
    setView({
      scale: origin.view.scale,
      x: origin.view.x + (event.clientX - origin.pointerX),
      y: origin.view.y + (event.clientY - origin.pointerY),
    });
  }, []);

  const endPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panOrigin.current) return;
    panOrigin.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  // React registers wheel passively on the root, so preventDefault needs a
  // native non-passive listener to stop the browser's page/pinch zoom.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      // Trackpad pinch arrives as ctrlKey+wheel with much finer deltas.
      const intensity = event.ctrlKey || event.metaKey ? 0.01 : 0.0018;
      const factor = Math.exp(-event.deltaY * intensity);
      zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target;
      // Do not hijack space while typing in the config editor.
      if (target instanceof HTMLElement && target.matches("input, textarea, [contenteditable]")) {
        return;
      }
      setSpaceHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Content is measured asynchronously (fonts, avatars), so a fit requested
  // before the first non-zero measurement is replayed here.
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const observer = new ResizeObserver(() => {
      if (pendingFit.current) fitToContent();
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [fitToContent]);

  // Deferred to the next frame: the fit needs the browser's post-layout
  // measurements, which are not available during the effect itself.
  useEffect(() => {
    if (!initialFit) return;
    pendingFit.current = true;
    const frame = requestAnimationFrame(() => fitToContent());
    return () => cancelAnimationFrame(frame);
  }, [initialFit, fitKey, fitToContent]);

  const grid = gridImage(gridBackground);
  const gridStep = GRID_SIZE * view.scale;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-zinc-800 shadow-inner ${className ?? ""}`}
      style={{ background }}
    >
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none"
        style={{
          cursor: panning ? "grabbing" : "grab",
          backgroundImage: grid,
          backgroundSize: grid ? `${gridStep}px ${gridStep}px` : undefined,
          // Grid rides along with the transform so it reads as canvas paper.
          backgroundPosition: grid ? `${view.x}px ${view.y}px` : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={(event) => {
          if (isNoPanTarget(event.target)) return;
          fitToContent();
        }}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 w-fit origin-top-left will-change-transform"
          style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
        >
          {children}
        </div>
      </div>

      <div
        {...{ [NO_PAN_ATTR]: true }}
        data-canvas-toolbar
        role="toolbar"
        aria-label="画布视图控制"
        className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-900/90 p-1 shadow-lg backdrop-blur"
      >
        <ToolbarButton label="缩小" onClick={() => zoomBy(1 / 1.25)}>
          <Minus size={14} />
        </ToolbarButton>
        <button
          type="button"
          onClick={() => zoomBy(1 / view.scale)}
          title="点击回到 100%"
          className="min-w-[52px] rounded px-1 py-1 text-center font-mono text-[11px] text-zinc-300 tabular-nums hover:bg-zinc-800 hover:text-zinc-100"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <ToolbarButton label="放大" onClick={() => zoomBy(1.25)}>
          <Plus size={14} />
        </ToolbarButton>
        <div className="mx-0.5 h-5 w-px bg-zinc-700" />
        <ToolbarButton label="复位（100%）" onClick={reset}>
          <Crosshair size={14} />
        </ToolbarButton>
        <ToolbarButton label="适应窗口（双击画布同效）" onClick={fitToContent}>
          <Maximize2 size={14} />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-1 focus-visible:outline-amber-500"
    >
      {children}
    </button>
  );
}

export default Canvas;
