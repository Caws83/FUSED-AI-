#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { repoRoot } from "./repo-env.mjs";

function freePort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        const info = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: "utf8" });
        if (/node\.exe/i.test(info)) {
          execSync(`taskkill /PID ${pid} /F`);
          console.log(`Stopped stale Node process on port ${port} (pid ${pid}).`);
        }
      }
    }
  } catch {
    /* port already free */
  }
}

freePort(3000);
const root = repoRoot();
const require = createRequire(import.meta.url);
const concurrently = path.join(path.dirname(require.resolve("concurrently/package.json")), "dist", "bin", "concurrently.js");
const child = spawn(
  process.execPath,
  [
    concurrently,
    "-k",
    "-n",
    "web,indexer",
    "-c",
    "green,magenta",
    "npm run dev",
    "npm run indexer",
  ],
  { cwd: root, stdio: "inherit", env: process.env, shell: false },
);
child.on("exit", (code) => process.exit(code ?? 0));
