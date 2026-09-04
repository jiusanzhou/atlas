/** How the text ended up copied; `manual` means the caller must show it instead. */
export type CopyOutcome = "clipboard" | "execCommand" | "manual";

/** Async Clipboard API first, off-screen textarea second, give up third. */
export async function copyText(text: string): Promise<CopyOutcome> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    } catch {
      // Denied permission, insecure context, or an unfocused document.
    }
  }

  return copyViaTextarea(text) ? "execCommand" : "manual";
}

function copyViaTextarea(text: string): boolean {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  // Off-screen rather than hidden: execCommand only copies a rendered selection.
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
