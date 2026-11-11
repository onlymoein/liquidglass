import { describe, expect, test } from "vitest";

import dependabot from "../.github/dependabot.yml?raw";
import pages from "../.github/workflows/pages.yml?raw";
import performance from "../.github/workflows/performance.yml?raw";
import lock from "../package-lock.json?raw";
import manifest from "../package.json?raw";

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

// Runs on every pull request, including ones from forks, and installs dependencies, so it
// must hold nothing that could write to the repo or publish.
describe("performance workflow", () => {
  test("pins every action to a full commit SHA", () => {
    const found = uses(performance);
    expect(found.length).toBeGreaterThan(0);
    for (const action of found) expect(action).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  test("can only read the repo, and nothing in it can write or mint a token", () => {
    expect(block(performance, /^permissions:/).trim()).toBe("contents: read");
    expect(performance).not.toMatch(/\b[\w-]+:\s*write\b/);
    expect(performance).not.toContain("secrets.");
    expect(performance).not.toMatch(/pull_request_target/);
  });

  test("keeps the checkout's credentials out of the steps that run dependencies", () => {
    expect(performance).toContain("persist-credentials: false");
  });
});

// Dependencies the build and CI tools reach, which npm audit holds to account even where
// the vulnerable code can't run. basic-ftp < 6.2.1 backtracks quadratically on a listing line
// (GHSA-c475-qrg2-pj4r); Lighthouse CI pulls it in through proxy-agent and get-uri, which
// ask for ^5, so it's pinned past the fix here.
describe("dependencies", () => {
  const atLeast = (version: string, floor: number[]) => {
    const parts = version.split(".").map(Number);
    for (let i = 0; i < floor.length; i++) {
      if ((parts[i] ?? 0) !== floor[i]) return (parts[i] ?? 0) > floor[i]!;
    }
    return true;
  };

  test("pins basic-ftp past its listing-parser fix", () => {
    expect(JSON.parse(manifest).overrides?.["basic-ftp"]).toBe("^6.2.1");
  });

  test("resolves basic-ftp to a fixed version everywhere in the lockfile", () => {
    const packages: Record<string, { version: string }> = JSON.parse(lock).packages;
    const found = Object.entries(packages).filter(([path]) => path.endsWith("node_modules/basic-ftp"));
    for (const [, entry] of found) expect(atLeast(entry.version, [6, 2, 1])).toBe(true);
  });
});
