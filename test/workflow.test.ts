import { describe, expect, test } from "vitest";

import dependabot from "../.github/dependabot.yml?raw";
import pages from "../.github/workflows/pages.yml?raw";

// The site is built from this repo's dependency tree, so a compromised package
// runs inside the build. These keep that from reaching anything that can publish.

const uses = (text: string) => [...text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((match) => match[1]!);

// The text of a top-level or job-level block, up to the next line indented no deeper.
function block(text: string, header: RegExp): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => header.test(line));
  if (start < 0) return "";
  const indent = lines[start]!.match(/^\s*/)![0].length;
  const end = lines.findIndex((line, i) => i > start && line.trim() !== "" && line.match(/^\s*/)![0].length <= indent);
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

describe("pages workflow", () => {
  test("pins every action to a full commit SHA", () => {
    const found = uses(pages);
    expect(found.length).toBeGreaterThan(0);
    for (const action of found) expect(action).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  test("grants only read access by default", () => {
    expect(block(pages, /^permissions:/).trim()).toBe("contents: read");
  });

  test("keeps publishing rights out of the job that installs dependencies", () => {
    const build = block(pages, /^ {2}build:/);
    expect(build).toContain("npm ci");
    expect(build).not.toMatch(/\b(pages|id-token|contents):\s*write/);
    expect(build).not.toContain("deploy-pages");
    expect(build).toContain("persist-credentials: false");
  });

  test("gives the deploy job only what publishing needs, and runs no repo code in it", () => {
    const deploy = block(pages, /^ {2}deploy:/);
    expect(block(deploy, /^ {4}permissions:/).trim().split("\n").map((line) => line.trim()).sort()).toEqual([
      "id-token: write",
      "pages: write",
    ]);
    expect(deploy).toContain("needs: build");
    expect(deploy).not.toMatch(/^\s*-?\s*run:/m);
    expect(deploy).not.toContain("checkout");
  });

  test("is kept current by Dependabot", () => {
    expect(dependabot).toContain("package-ecosystem: github-actions");
  });
});
