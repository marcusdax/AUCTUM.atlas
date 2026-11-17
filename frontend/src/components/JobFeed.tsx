import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import socketService from '../services/socket';
import { useAuthStore } from '../stores/authStore';
import { FeedPost } from '../types';
import Button from './ui/Button';
import { Badge } from './ui/Card';
import {
  Send,
  Smile,
  Paperclip,
  ImageIcon,
  FileText,
  User as UserIcon,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const IMAGE_FILE_TYPES = ['IMAGE'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

function isImagePost(attachment: { fileType: string; fileUrl: string }): boolean {
  if (IMAGE_FILE_TYPES.includes(attachment.fileType)) return true;
  const ext = attachment.fileUrl.substring(attachment.fileUrl.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

function fileTypeName(type?: string): string {
  switch (type) {
    case 'IMAGE':
      return 'Image';
    case 'VIDEO':
      return 'Video';
    case 'DOCUMENT':
      return 'Document';
    default:
      return 'File';
  }
}

function formatDate(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'PPpp');
  } catch {
    return String(date);
  }
}

function formatTimeAgo(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

// De-duplicate by id, newest first
function mergePosts(incoming: FeedPost[], existing: FeedPost[]): FeedPost[] {
  const byId = new Map<string, FeedPost>();
  [...incoming, ...existing].forEach((p) => {
    if (!byId.has(p.id)) byId.set(p.id, p);
  });
  return Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return tb - ta;
  });
}

interface JobFeedProps {
  jobId: string;
}

const fetchPosts = async (jobId: string): Promise<FeedPost[]> => {
  const res = await api.get(`/feed/${jobId}/posts`);
  return (res.data.posts ?? []) as FeedPost[];
};

const JobFeed: React.FC<JobFeedProps> = ({ jobId }) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const meName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Me';
  const meAvatar =
    user?.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(meName)}&background=3b82f6&color=fff`;
  const [composer, setComposer] = useState('');

  const {
    data: remotePosts,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['job-feed', jobId],
    queryFn: () => fetchPosts(jobId),
    placeholderData: [],
  });

  const [localPosts, setLocalPosts] = useState<FeedPost[]>([]);

  // Sync the local list with the remotely-fetched posts (initial load + refetches),
  // while preserving any posts that only exist in local state (e.g. very recent).
  useEffect(() => {
    if (remotePosts) {
      setLocalPosts((prev) => mergePosts(remotePosts, prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remotePosts]);

  const createMutation = useMutation({
    mutationFn: (content: string) =>
      api
        .post(`/feed/${jobId}/posts`, { content })
        .then((res) => res.data.post as FeedPost),
    onSuccess: () => {
      setComposer('');
      // The server broadcasts `feed.new_post` to the job room; the socket
      // listener below updates the list. Invalidate so a refetch stays in sync.
      queryClient.invalidateQueries({ queryKey: ['job-feed', jobId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to post message');
    },
  });

  // ─── Socket.IO real-time updates ───────────────────────────
  useEffect(() => {
    const socket = socketService.getSocket();

    const join = () => socketService.joinJob(jobId);
    const handleNewPost = (payload: {
      post?: FeedPost;
      jobId?: string;
      companyWide?: boolean;
    }) => {
      if (!payload || payload.companyWide || payload.jobId !== jobId) return;
      if (!payload.post) return;
      setLocalPosts((prev) => mergePosts([payload.post as FeedPost], prev));
    };
    const handleDelete = (payload: { postId?: string; jobId?: string }) => {
      if (!payload || payload.jobId !== jobId) return;
      setLocalPosts((prev) => prev.filter((p) => p.id !== payload.postId));
    };
    const handleReply = (payload: {
      post?: FeedPost;
      jobId?: string;
      parentPostId?: string;
    }) => {
      if (!payload || payload.jobId !== jobId) return;
      if (!payload.post) return;
      // Add the reply under its parent if present, otherwise append.
      setLocalPosts((prev) => {
        const post = payload.post as FeedPost;
        const withReply = prev.map((p) => {
          if (p.id === payload.parentPostId) {
            const replies = [...(p.replies ?? []), post];
            return { ...p, replies };
          }
          return p;
        });
        const merged = mergePosts([], withReply);
        return merged;
      });
    };

    socketService.on('connect', join);
    socketService.on('feed.new_post', handleNewPost);
    socketService.on('feed.new_reply', handleReply);
    socketService.on('feed.post_deleted', handleDelete);

    if (socket?.connected) {
      join();
    }

    return () => {
      socketService.off('connect', join);
      socketService.off('feed.new_post', handleNewPost);
      socketService.off('feed.new_reply', handleReply);
      socketService.off('feed.post_deleted', handleDelete);
      socketService.leaveJob(jobId);
    };
  }, [jobId]);

  const handlePost = () => {
    const content = composer.trim();
    if (!content) return;
    createMutation.mutate(content);
  };

  const displayName = (post: FeedPost): string => {
    if (post.user) {
      return `${post.user.firstName ?? ''} ${post.user.lastName ?? ''}`.trim() || 'Someone';
    }
    return 'Someone';
  };

  const avatar = (post: FeedPost): string => {
    return post.user?.avatarUrl
      ? post.user.avatarUrl
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName(post))}&background=3b82f6&color=fff`;
  };

  return (
    <div className="flex h-[520px] flex-col gap-3">
      {/* Composer */}
      <div className="flex items-start gap-3">
        <img
          src={meAvatar}
          alt={meName}
          className="h-9 w-9 rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(meName)}&background=3b82f6&color=fff`;
          }}
        />
        <div className="flex-1">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="Write something for the job feed..."
            rows={composer.split('\n').length > 1 ? 3 : 2}
            className="w-full resize-y rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            maxLength={2000}
          />
          <div className="mt-2 flex items-center justify-between">
            {composer.length > 0 && (
              <Badge variant="default" size="sm">
                {composer.length}/2000
              </Badge>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<Paperclip size={16} />}
                title="Attach a file (coming soon)"
                disabled
                aria-label="Attach file"
              >
                Attach
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Send size={16} />}
                isLoading={createMutation.isPending}
                disabled={!composer.trim() || createMutation.isPending}
                onClick={handlePost}
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Posts list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && localPosts.length === 0 ? (
          <div className="py-8 text-center text-text-tertiary">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="py-6 text-center text-sm text-red">
            Couldn't load feed. Try again later.
          </div>
        ) : localPosts.length === 0 ? (
          <div className="py-8 text-center text-text-tertiary">
            <UserIcon size={32} className="mx-auto mb-2 opacity-40" />
            <p>No posts yet. Be the first to share an update on this job.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {localPosts.map((post) => (
              <article key={post.id} className="group">
                <header className="flex items-start gap-3">
                  <img
                    src={avatar(post)}
                    alt={displayName(post)}
                    className="h-9 w-9 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName(post))}&background=3b82f6&color=fff`;
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm text-text-primary">
                        {displayName(post)}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {formatTimeAgo(post.createdAt)}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        • {formatDate(post.createdAt)}
                      </span>
                    </div>

                    {post.content && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                        {post.content}
                      </p>
                    )}

                    {/* Mentions */}
                    {post.mentions && post.mentions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {post.mentions.map((m) => (
                          <Badge key={m.id} variant="info" size="sm">
                            @{m.user?.firstName || m.userId?.slice(0, 8)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Attachments */}
                    {post.attachments && post.attachments.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {post.attachments.map((att) => {
                          const isImg = isImagePost(att);
                          return (
                            <div
                              key={att.id}
                              className="relative rounded-lg border border-border bg-[hsl(var(--background-card))] p-1.5"
                            >
                              {isImg ? (
                                <img
                                  src={att.fileUrl}
                                  alt={att.fileName}
                                  className="h-16 w-full rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-16 items-center gap-2">
                                  <FileText size={20} className="text-text-tertiary shrink-0" />
                                  <span
                                    className="truncate text-xs text-text-secondary"
                                    title={att.fileName}
                                  >
                                    {att.fileName}
                                  </span>
                                </div>
                              )}
                              <a
                                href={att.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute inset-0 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                                aria-label={`Open ${att.fileName}`}
                              />
                              {att.size ? (
                                <span className="mt-1 block text-[10px] text-text-tertiary">
                                  {(att.size / 1024).toFixed(1)} KB
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Replies (inline, read-only for this view) */}
                    {post.replies && post.replies.length > 0 && (
                      <div className="mt-3 space-y-2.5 pl-4 border-l-2 border-border">
                        {post.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2.5">
                            <img
                              src={avatar(reply)}
                              alt={displayName(reply)}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                            <div className="flex-1">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xs font-medium text-text-primary">
                                  {displayName(reply)}
                                </span>
                                <span className="text-[10px] text-text-tertiary">
                                  {formatTimeAgo(reply.createdAt)}
                                </span>
                              </div>
                              {reply.content && (
                                <p className="text-xs text-text-secondary">
                                  {reply.content}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </header>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobFeed;
