"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, PostCard } from "@fused-ai/ui";
import type { SocialPost } from "@fused-ai/types";
import { relativeTime, shortenAddress } from "../lib/feed.ts";
import { writeFuseHandoff } from "../lib/fuse-handoff.ts";

export function FeedPosts({ posts }: { posts: readonly SocialPost[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  if (posts.length === 0) {
    return <EmptyState title="No conversations yet." body="When someone posts, it shows up here." />;
  }

  function fuseThis(text: string) {
    setNotice(null);
    if (!writeFuseHandoff(text)) {
      setNotice("This post is too short to fuse.");
      return;
    }
    router.push("/launch");
  }

  return (
    <div className="fused-feed-list">
      {notice ? <p className="fused-form-error">{notice}</p> : null}
      {posts.map((post) => (
        <PostCard
          key={`${post.platform}-${post.postId}`}
          author={shortenAddress(post.authorId)}
          username=""
          displayName={post.profileDisplayName}
          text={post.text}
          timestamp={relativeTime(post.publishedAt)}
          engagement=""
          avatarUrl={post.avatarUrl}
          fuseDisabled={false}
          fuseLabel="FUSE THIS"
          onFuse={() => fuseThis(post.text)}
        />
      ))}
    </div>
  );
}
