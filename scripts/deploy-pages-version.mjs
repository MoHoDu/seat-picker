import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_PAGES_BASE = "/seat-picker/";
const PAGES_BRANCH = "gh-pages";
const PRESERVED_ROOT_ENTRIES = new Set([".git", ".nojekyll", "CNAME", "versions"]);

const repoRoot = process.cwd();
const target = process.argv[2] ?? "";

if (!target) {
  fail("Usage: node scripts/deploy-pages-version.mjs latest|v1.1");
}

if (target !== "latest" && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(target)) {
  fail(`Invalid version target: ${target}`);
}

const isLatest = target === "latest";
const basePath = isLatest ? REPO_PAGES_BASE : `${REPO_PAGES_BASE}versions/${target}/`;
const deployRelativePath = isLatest ? "." : join("versions", target);

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

async function main() {
  log(`Building ${target} with base ${basePath}`);
  run("npm", ["run", "build"], {
    cwd: repoRoot,
    env: { ...process.env, VITE_BASE_PATH: basePath },
  });

  const distDir = join(repoRoot, "dist");
  if (!existsSync(join(distDir, "index.html"))) {
    fail("dist/index.html was not found. Build did not create a deployable app.");
  }

  log(`Preparing ${PAGES_BRANCH} worktree`);
  run("git", ["fetch", "origin", PAGES_BRANCH], { cwd: repoRoot });

  const pagesDir = mkdtempSync(join(tmpdir(), "seat-picker-pages-"));
  let worktreeAdded = false;

  try {
    run("git", ["worktree", "add", "--detach", pagesDir, "FETCH_HEAD"], { cwd: repoRoot });
    worktreeAdded = true;

    if (isLatest) {
      cleanLatestRoot(pagesDir);
    } else {
      rmSync(join(pagesDir, deployRelativePath), { recursive: true, force: true });
    }

    await cp(distDir, join(pagesDir, deployRelativePath), {
      recursive: true,
      force: true,
    });

    writeFileSync(join(pagesDir, ".nojekyll"), "");

    run("git", ["add", "-A"], { cwd: pagesDir });

    const status = execGit(["status", "--porcelain"], pagesDir).trim();
    if (!status) {
      log("No GitHub Pages changes to deploy.");
      return;
    }

    run("git", ["commit", "-m", `deploy: Update ${target} pages build`], {
      cwd: pagesDir,
    });
    run("git", ["push", "origin", `HEAD:${PAGES_BRANCH}`], { cwd: pagesDir });

    log(`Deployed ${target} to ${isLatest ? REPO_PAGES_BASE : basePath}`);
  } finally {
    if (worktreeAdded) {
      run("git", ["worktree", "remove", "--force", pagesDir], { cwd: repoRoot });
    } else {
      rmSync(pagesDir, { recursive: true, force: true });
    }
  }
}

function cleanLatestRoot(pagesDir) {
  for (const entry of readdirSync(pagesDir)) {
    if (PRESERVED_ROOT_ENTRIES.has(entry)) {
      continue;
    }

    rmSync(join(pagesDir, entry), { recursive: true, force: true });
  }
}

function execGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function log(message) {
  console.log(`[deploy-pages-version] ${message}`);
}

function fail(message) {
  console.error(`[deploy-pages-version] ${message}`);
  process.exit(1);
}
