import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { FeedPost } from '../../types';
import { useSocket } from '../../components/providers/SocketProvider';
import {
  Send,
  Paperclip,
  User,
  Clock,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react';

const JobFeed: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['job-feed', jobId],
    queryFn: () => api.get(`/feed/${jobId}/posts`).then((res) => res.data),
    enabled: Boolean(jobId),
  });

  const posts: FeedPost[] = data?.posts || [];

  const handleNewPost = useCallback(async () => {
    if (!newPostContent.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post(`/feed/${jobId}/posts`, { content: newPostContent });
      setNewPostContent('');
      queryClient.invalidateQueries({ queryKey: ['job-feed', jobId] });
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [jobId, newPostContent, queryClient]);

  useEffect(() => {
    if (socket && jobId) {
      socket.joinJob(jobId);
      socket.on('feed:new_post', (post: FeedPost) => {
        queryClient.invalidateQueries({ queryKey: ['job-feed', jobId] });
      });
    }
    return () => {
      if (socket && jobId) {
        socket.off('feed:new_post');
      }
    };
  }, [socket, jobId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p>Loading feed…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/jobs/${jobId}`)}>
          <ArrowLeft size={16} />
          Back to Job
        </Button>
        <h1 className="text-3xl font-bold text-text-primary">Job Feed</h1>
      </div>

      <Card className="mb-6">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold">
            <User size={20} />
          </div>
          <div className="flex-1">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Write a post…"
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Paperclip size={14} />}>
                Attach
              </Button>
              <Button size="sm" leftIcon={<Send size={14} />} isLoading={isSubmitting} onClick={handleNewPost}>
                Post
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-text-tertiary">
            <MessageCircle size={48} className="mx-auto mb-3 opacity-30" />
            <p>No posts yet. Be the first to share an update!</p>
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id} variant="bordered" className="p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold">
                  {post.user?.firstName?.[0]}
                  {post.user?.lastName?.[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-text-primary">
                      {post.user?.firstName} {post.user?.lastName}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      <Clock size={12} className="inline mr-1" />
                      {new Date(post.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-text-secondary whitespace-pre-wrap">{post.content}</p>
                  {post.attachments && post.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {post.attachments.map((attachment) => (
                        <div key={attachment.id} className="text-xs text-text-tertiary">
                          📎 {attachment.fileName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default JobFeed;
