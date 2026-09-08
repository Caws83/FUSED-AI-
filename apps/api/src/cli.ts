import { loadEnv, loadRepoEnv, systemStatus } from "@fused-ai/config";

loadRepoEnv();
const status = systemStatus(loadEnv());
console.log(JSON.stringify(status, null, 2));
