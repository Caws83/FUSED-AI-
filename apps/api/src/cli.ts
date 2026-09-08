import { loadEnv, systemStatus } from "@fused-ai/config";

const status = systemStatus(loadEnv());
console.log(JSON.stringify(status, null, 2));
