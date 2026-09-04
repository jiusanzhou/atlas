import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/clipboard";
import { toDrawioXML } from "@/lib/drawio";
import { parseConfig } from "@/lib/parser";

const SOURCE = `domains:
  - name: infra
    displayName: 基础设施
    lead: torvalds
people:
  - id: torvalds
    name: Linus Torvalds
    homeDomain: infra
`;

/** Minimal stand-in for the DOM bits `copyViaTextarea` touches. */
function stubDocument(execCommand: () => boolean) {
  const created: { value: string }[] = [];
  vi.stubGlobal("document", {
    createElement: () => {
      const element = {
        value: "",
        style: {} as Record<string, string>,
        setAttribute: () => {},
        select: () => {},
        remove: () => {},
      };
      created.push(element);
      return element;
    },
    body: { appendChild: () => {} },
    execCommand,
  });
  return created;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("writes through the async clipboard API when available", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText("hello")).resolves.toBe("clipboard");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to a textarea when the clipboard API rejects", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    });
    const created = stubDocument(() => true);

    await expect(copyText("payload")).resolves.toBe("execCommand");
    expect(created).toHaveLength(1);
    expect(created[0].value).toBe("payload");
  });

  it("uses the textarea path when there is no clipboard API at all", async () => {
    vi.stubGlobal("navigator", {});
    stubDocument(() => true);

    await expect(copyText("payload")).resolves.toBe("execCommand");
  });

  it("reports manual when every path fails", async () => {
    vi.stubGlobal("navigator", {});
    stubDocument(() => false);

    await expect(copyText("payload")).resolves.toBe("manual");
  });

  it("reports manual when execCommand throws", async () => {
    vi.stubGlobal("navigator", {});
    stubDocument(() => {
      throw new Error("unsupported");
    });

    await expect(copyText("payload")).resolves.toBe("manual");
  });
});

describe("copying drawio XML", () => {
  it("hands the generated mxfile to the clipboard unchanged", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const xml = toDrawioXML(parseConfig(SOURCE).config);
    await expect(copyText(xml)).resolves.toBe("clipboard");

    const copied = writeText.mock.calls[0][0];
    expect(copied).toBe(xml);
    expect(copied).toContain("<mxfile");
    expect(copied).toContain("基础设施");
  });
});
