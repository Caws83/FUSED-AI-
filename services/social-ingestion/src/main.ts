import { loadEnv } from "@fused-ai/config";
import { createSocialProvider } from "@fused-ai/social";

export async function runSocialIngestion() {
  const provider = createSocialProvider(loadEnv());
  const trending = await provider.trending();
  return trending;
}

const isMain = process.argv[1] && process.argv[1].endsWith("main.ts");
if (isMain) {
  void runSocialIngestion().then((result) => {
    console.error(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  });
}
