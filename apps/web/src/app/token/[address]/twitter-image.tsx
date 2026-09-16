import { parseSupportedChainId } from "@fused-ai/config";
import { renderTokenOpenGraphImage } from "./opengraph-image.tsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { alt, size, contentType } from "./opengraph-image.tsx";

export default async function Image({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams?: Promise<{ chainId?: string }>;
}) {
  const { address } = await params;
  const query = searchParams ? await searchParams : {};
  return renderTokenOpenGraphImage(address, parseSupportedChainId(query.chainId));
}
