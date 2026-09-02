import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const EXAMPLES_DIR = join(process.cwd(), "examples");

/** Server-only: reads the bundled demo config shipped in examples/. */
export async function loadDemoConfigSource(): Promise<string> {
  return readFile(join(EXAMPLES_DIR, "demo.yaml"), "utf8");
}
