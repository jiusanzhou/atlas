"use client";

import { useSyncExternalStore } from "react";
import { THEMES, normalizeThemeName, type ThemeName } from "@/lib/schema";
import { themes } from "@/lib/themes";

export const THEME_STORAGE_KEY = "atlas:theme";

function readStoredTheme(): ThemeName | null {
  try {
    // normalizeThemeName maps the withdrawn business/blueprint names onto
    // hearthstone, so a browser that remembers one of them still renders.
    return normalizeThemeName(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Private mode / blocked storage: fall back to the config's own theme.
    return null;
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the choice should move this one too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Exposed as an external store rather than effect-synced state: the value only
 * exists on the client, and useSyncExternalStore gives a correct SSR snapshot
 * without a setState-in-effect hydration pass.
 */
export function useStoredTheme(): ThemeName | null {
  return useSyncExternalStore(subscribe, readStoredTheme, () => null);
}

export function storeTheme(name: ThemeName): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, name);
  } catch {
    // Persistence is a convenience; a failure must not break the switch.
  }
  for (const listener of listeners) listener();
}

interface ThemeSwitcherProps {
  value: ThemeName;
  onChange: (name: ThemeName) => void;
}

/** Segmented control over every registered theme. */
export function ThemeSwitcher({ value, onChange }: ThemeSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="主题"
      data-theme-switcher
      className="flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-900 p-0.5"
    >
      {THEMES.map((name) => {
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            data-theme-option={name}
            data-selected={selected ? "true" : undefined}
            onClick={() => onChange(name)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              selected
                ? "bg-amber-600 text-zinc-950"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
          >
            {themes[name].label}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSwitcher;
