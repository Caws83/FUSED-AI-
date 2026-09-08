#!/usr/bin/env node
import { spawn } from "node:child_process";
import { foundryBin } from "./repo-env.mjs";

const anvil = foundryBin("anvil");
const child = spawn(
  anvil,
  ["--host", "127.0.0.1", "--port", "8545", "--chain-id", "31337", "--accounts", "10"],
  { stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));
