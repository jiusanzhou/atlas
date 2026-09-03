"use client";

import Markdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ThemeTokens } from "@/lib/themes/types";

/**
 * Links come from user config, so never keep the opener's window reference.
 * `node` is react-markdown's AST handle and must not reach the DOM.
 */
const MARKDOWN_COMPONENTS = {
  a: (props: React.ComponentPropsWithoutRef<"a"> & ExtraProps) => {
    const { children, ...rest } = props;
    delete rest.node;
    return (
      <a {...rest} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

/** The --md-* vars the .markdown-body rules read, sourced from theme tokens. */
export function markdownVars(theme: ThemeTokens): React.CSSProperties {
  return {
    "--md-text": theme.textPrimary,
    "--md-accent": theme.accent,
    "--md-soft": theme.accentSoft,
    "--md-code-bg": theme.tagBackground,
  } as React.CSSProperties;
}

export function CommentMarkdown({ source }: { source: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {source}
    </Markdown>
  );
}
