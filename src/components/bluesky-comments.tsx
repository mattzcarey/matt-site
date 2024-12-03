'use client';
import { useEffect, useState } from 'react';

interface CommentOptions {
  uri: string;
}

type Reply = {
  post: {
    uri: string;
    author: {
      avatar: string;
      displayName: string;
      handle: string;
      did: string;
    };
    record: {
      text: string;
    };
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
  };
};

type Thread = {
  replies: Reply[];
  post: {
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
  };
};

const formatUri = (uri: string): string => {
  if (!uri.startsWith('at://') && uri.includes('bsky.app/profile/')) {
    const match = uri.match(/profile\/([\w.]+)\/post\/([\w]+)/);
    if (match) {
      const [, handle, postId] = match;
      return `at://${handle}/app.bsky.feed.post/${postId}`;
    }
  }
  return uri;
};

export default function BlueskyComments({ uri }: Pick<CommentOptions, 'uri'>): JSX.Element {
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const atUri = formatUri(uri);
        const params = new URLSearchParams({ uri: atUri });
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              "Accept": "application/json",
            },
            cache: "no-store",
          }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch comments");
        }

        const data = await res.json();
        setThread(data.thread);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load comments');
      }
    };

    if (uri) {
      fetchComments();
    }
  }, [uri]);

  if (error) {
    return <div className="text-red-500">Error loading comments: {error}</div>;
  }

  if (!thread) {
    return <div className="animate-pulse">Loading comments...</div>;
  }

  const postUrl = uri.replace('at://', 'https://bsky.app/profile/');

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Comments</h3>
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1">
            <span>💙 {thread.post.likeCount || 0}</span>
          </span>
          <span className="flex items-center gap-1">
            <span>🔄 {thread.post.repostCount || 0}</span>
          </span>
          <span className="flex items-center gap-1">
            <span>💬 {thread.post.replyCount || 0}</span>
          </span>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Reply on Bluesky{" "}
        <a href={postUrl} target="_blank" rel="noreferrer noopener" className="text-blue-500 hover:underline">
          here
        </a>{" "}
        to join the conversation.
      </p>

      <div className="space-y-4">
        {thread.replies?.map((reply: Reply) => (
          <div key={reply.post.uri} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <a 
                href={`https://bsky.app/profile/${reply.post.author.did}`}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 hover:opacity-80"
              >
                <img 
                  src={reply.post.author.avatar} 
                  alt={reply.post.author.displayName}
                  className="w-6 h-6 rounded-full"
                />
                <span className="font-medium">{reply.post.author.displayName}</span>
                <span className="text-sm text-gray-500">@{reply.post.author.handle}</span>
              </a>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{reply.post.record.text}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>💙 {reply.post.likeCount || 0}</span>
              <span>🔄 {reply.post.repostCount || 0}</span>
              <span>💬 {reply.post.replyCount || 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 