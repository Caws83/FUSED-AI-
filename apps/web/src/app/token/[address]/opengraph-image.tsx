import { ImageResponse } from "next/og";
import { loadPublicEnv, loadRepoEnv, parseSupportedChainId } from "@fused-ai/config";
import { loadLaunchPage } from "../../../lib/launches.ts";
import {
  TOKEN_OG_ART,
  TOKEN_OG_SIZE,
  resolveTokenOgImgSrc,
} from "../../../lib/token-og.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Token";
export const size = TOKEN_OG_SIZE;
export const contentType = "image/png";

function FallbackMark() {
  return (
    <div
      style={{
        display: "flex",
        width: TOKEN_OG_ART,
        height: TOKEN_OG_ART,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 40,
        background: "#0b1220",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 220,
          height: 220,
          borderRadius: 110,
          border: "18px solid #c8f135",
        }}
      />
    </div>
  );
}

export async function renderTokenOpenGraphImage(
  address: string,
  chainId: number | null,
) {
  loadRepoEnv();
  const pub = loadPublicEnv();
  const loaded = await loadLaunchPage(address, chainId);
  const launch = loaded?.launch;
  const src = await resolveTokenOgImgSrc(
    launch?.imageUrl,
    launch?.chainId ?? chainId,
    pub.appUrl,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f7fb",
        }}
      >
        <div
          style={{
            display: "flex",
            width: TOKEN_OG_ART,
            height: TOKEN_OG_ART,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderRadius: 40,
            background: "#ffffff",
          }}
        >
          {src ? (
            <img
              src={src}
              alt=""
              width={TOKEN_OG_ART}
              height={TOKEN_OG_ART}
              style={{
                width: TOKEN_OG_ART,
                height: TOKEN_OG_ART,
                objectFit: "contain",
              }}
            />
          ) : (
            <FallbackMark />
          )}
        </div>
      </div>
    ),
    { ...TOKEN_OG_SIZE },
  );
}

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
