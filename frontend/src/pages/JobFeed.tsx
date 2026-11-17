/**
 * JobFeed — Real-time job communication hub for RoofPro CRM.
 *
 * Features:
 *   - Threaded posts (parent + replies)
 *   - Real-time updates via Socket.IO (feed.new_post / feed.new_reply / feed.post_deleted)
 *   - Rich-text composer with @mention autocomplete (fetch users from /auth/users)
 *   - Drag-and-drop attachment upload (images, documents, video)
 *   - System posts (status changes, estimate approvals) with distinct styling
 *   - Mention badges with highlighted rendering in post content
 *
 * Usage: <JobFeed jobId="job-uuid" />
 */
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../components/providers/SocketProvider';
import { FeedPost, FeedAttachment, FeedMention, User } from '../types';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Card';
import {
  Send,
  Paperclip,
  MessageCircle,
  Trash2,
  Bold,
  Italic,
  X,
  Clock,
  Shield,
  FileText,
  FileImage,
  User as UserIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ─── Constants ───────────────────────────────────────────────

const USER_AVATAR_SIZE = 32;
const MAX_DROPDOWN_HEIGHT = 240;

// ─── Helpers ──────────────────────────────────────────────────

const getUserInitials = (user?: { firstName?: string; lastName?: string }): string => {
  if (!user) return 'S';
  const fi = user.firstName?.[0] ?? '';
  const li = user.lastName?.[0] ?? '';
  const result = `${fi}${li}`.toUpperCase();
  return result || '?';
};

const formatTime = (dateStr: string): string => {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '—';
  }
};

const getFileIcon = (fileType: string | undefined) => {
  switch (fileType) {
    case 'IMAGE':
      return <FileImage size={20} className="text-primary" />;
    case 'VIDEO':
      return <FileText size={20} className="text-purple" />;
    default:
      return <FileText size={20} className="text-amber" />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const roleLabel = (role?: string): string => {
  if (!role) return '';
  return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/** Walk the DOM tree inside `element` and return the character offset of the caret. */
const getCaretCharIndex = (element: HTMLElement): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(element);
  range.setEnd(
    selection.getRangeAt(0).endContainer,
    selection.getRangeAt(0).endOffset
  );
  return range.toString().length;
};

/**
 * Convert a character index within a contentEditable element's text content
 * to a DOM Position (node + offset). Text inside mention-chip spans is
 * counted so indices stay consistent with innerText.
 */
const charIndexToDomPosition = (
  element: HTMLElement,
  targetIndex: number
): { node: Text; offset: number } | null => {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  let charIndex = 0;
  let node: Text | null = null;

  while ((node = walker.nextNode() as Text)) {
    const text = node.textContent || '';
    const len = text.length;

    if (charIndex + len > targetIndex) {
      return { node, offset: targetIndex - charIndex };
    }

    charIndex += len;
  }

  // Cursor at the very end
  if (element.lastChild) {
    const lastText = (
      element.lastChild.nodeType === Node.TEXT_NODE
        ? element.lastChild
        : null
    ) as Text | null;
    if (lastText) {
      return { node: lastText, offset: lastText.textContent?.length || 0 };
    }
  }

  return null;
};

/** Highlight @mentions in post content using the mentions array. */
const renderContentWithMentions = (
  content: string | undefined,
  mentions: FeedMention[] | undefined
): React.ReactNode => {
  if (!content) return null;

  if (!mentions || mentions.length === 0) return <>{content}</>;

  // Build a lookup of "@firstName" → user for mentioned users
  const mentionLookups: Array<{ label: string; user: User }> = [];
  for (const m of mentions) {
    if (m.user) {
      mentionLookups.push({
        label: `@${m.user.firstName}`,
        user: m.user,
      });
    }
  }

  if (mentionLookups.length === 0) return <>{content}</>;

  // Sort by label length (longest first) so multi-word names match first
  mentionLookups.sort((a, b) => b.label.length - a.label.length);

  const escaped = mentionLookups.map(m =>
    m.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = content.split(regex).filter(Boolean);

  return (
    <>
      {parts.map((part, i) => {
        const match = mentionLookups.find(m => m.label === part);
        if (match) {
          return (
            <span
              key={i}
              className="inline-block px-1 py-0.5 rounded bg-teal/10 text-teal font-medium"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

// ─── PostComposer ────────────────────────────────────────────

interface PostComposerProps {
  jobId: string;
  onPostCreated: (post: FeedPost) => void;
}

const PostComposer: React.FC<PostComposerProps> = ({ jobId, onPostCreated }) => {
  const { user } = useAuthStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionDropdownPos, setMentionDropdownPos] = useState({ x: 0, y: 0 });
  const [attachments, setAttachments] = useState<FeedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch company users for @mention autocomplete
  const { data: usersData } = useQuery<User[]>({
    queryKey: ['company-users', jobId],
    queryFn: () =>
      api
        .get('/auth/users')
        .then(res => res.data?.users ?? res.data),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const companyUsers = useMemo(() => usersData || [], [usersData]);

  // Filter users based on the mention query
  const filteredUsers = useMemo(() => {
    const q = mentionQuery.toLowerCase().trim();
    if (!q) return companyUsers;
    return companyUsers.filter(
      u =>
        u.firstName.toLowerCase().includes(q) ||
        (u.lastName || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [companyUsers, mentionQuery]);

  // ── Mention detection ──

  const checkForMention = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      setShowMentionDropdown(false);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      setShowMentionDropdown(false);
      return;
    }

    const range = selection.getRangeAt(0);

    // Ignore if cursor is inside a mention chip
    const container = range.startContainer;
    if (container.nodeType === Node.ELEMENT_NODE) {
      const el = container as HTMLElement;
      if (el.closest('.mention-chip') || el.classList.contains('mention-chip')) {
        setShowMentionDropdown(false);
        return;
      }
    }

    // Get text content before cursor
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.endContainer, range.endOffset);
    const textBefore = preRange.toString();

    // Match @letters at the end of text
    const match = textBefore.match(/@([a-zA-Z]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentionDropdown(true);

      // Position dropdown near cursor
      const rect = range.getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();
      setMentionDropdownPos({
        x: editorRect.left,
        y: rect.bottom + window.scrollY,
      });
    } else {
      setShowMentionDropdown(false);
    }
  }, []);

  const handleEditorInput = useCallback(() => {
    checkForMention();

    // Manage placeholder visibility (browsers add <br> to empty editables)
    const editor = editorRef.current;
    if (editor) {
      const isEmpty = editor.innerText.trim() === '';
      editor.setAttribute('data-empty', isEmpty ? 'true' : 'false');
    }
  }, [checkForMention]);

  // ── Mention insertion ──

  const insertMention = useCallback(
    (selectedUser: User) => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);

      // Get text before cursor to find @query
      const preRange = range.cloneRange();
      preRange.selectNodeContents(editor);
      preRange.setEnd(range.endContainer, range.endOffset);
      const textBefore = preRange.toString();

      const queryText = `@${mentionQuery}`;
      const atIndex = textBefore.lastIndexOf(queryText);
      const textLength = textBefore.length;

      // Create the mention span (non-editable)
      const span = document.createElement('span');
      span.className = 'mention-chip';
      span.setAttribute('data-user-id', selectedUser.id);
      span.setAttribute('data-display-name', `${selectedUser.firstName} ${selectedUser.lastName || ''}`);
      span.textContent = `@${selectedUser.firstName}`;
      span.contentEditable = 'false';
      Object.assign(span.style, {
        background: 'hsl(210 20% 25%)',
        color: 'hsl(191 90% 50%)',
        borderRadius: '0.25rem',
        padding: '0 4px',
        fontWeight: '500',
      });

      if (atIndex >= 0 && textBefore.endsWith(queryText)) {
        // Convert character positions to DOM positions
        const startPos = charIndexToDomPosition(editor, atIndex);
        const endPos = charIndexToDomPosition(editor, textLength);

        if (startPos && endPos) {
          const replaceRange = document.createRange();
          replaceRange.setStart(startPos.node, startPos.offset);
          replaceRange.setEnd(endPos.node, endPos.offset);

          selection.removeAllRanges();
          selection.addRange(replaceRange);
          replaceRange.deleteContents();
          replaceRange.insertNode(span);

          // Place cursor after the span
          const newRange = document.createRange();
          newRange.setStartAfter(span);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          // Fallback: simple insertion at cursor
          range.deleteContents();
          range.insertNode(span);
          const newRange = document.createRange();
          newRange.setStartAfter(span);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } else {
        // Fallback: insert at cursor
        range.deleteContents();
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.setStartAfter(span);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }

      editor.focus();
      setShowMentionDropdown(false);
      setMentionQuery('');
    },
    [mentionQuery]
  );

  // ── Attachment upload ──

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      if (!files || files.length === 0) return;

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      setIsUploading(true);
      try {
        const res = await api.post(`/feed/${jobId}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const newAttachments: FeedAttachment[] = res.data.attachments;
        setAttachments(prev => [...prev, ...newAttachments]);
      } catch {
        toast.error('Failed to upload files');
      } finally {
        setIsUploading(false);
      }
    },
    [jobId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // ── Submit ──

  const handleSubmit = async () => {
    const editor = editorRef.current;
    if (!editor) return;

    const content = editor.innerText || '';
    if (!content.trim() && attachments.length === 0) return;

    // Extract mention user IDs from the DOM
    const mentionSpans = editor.querySelectorAll('.mention-chip');
    const mentionedUserIds = Array.from(mentionSpans)
      .map(span => span.getAttribute('data-user-id'))
      .filter(Boolean) as string[];

    setIsSubmitting(true);
    try {
      const res = await api.post(`/feed/${jobId}/posts`, {
        content: content.trim() || undefined,
        attachmentIds: attachments.map(a => a.id),
        mentionedUserIds,
      });

      const newPost: FeedPost = res.data.post || res.data;

      // Clear composer
      editor.innerHTML = '';
      setAttachments([]);

      onPostCreated(newPost);
    } catch {
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Formatting ──

  const execCommand = (cmd: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(cmd);
    editor.focus();
  };

  // ── Outside click detection ──

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node)
      ) {
        setShowMentionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="border-b border-border p-4">
      <div className="flex gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-xs"
          style={{ width: USER_AVATAR_SIZE, height: USER_AVATAR_SIZE }}
        >
          {getUserInitials(
            user
              ? { firstName: user.firstName, lastName: user.lastName }
              : undefined
          )}
        </div>

        <div className="flex-1">
          {/* Formatting toolbar */}
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => execCommand('bold')}
              className="rounded p-1 text-text-tertiary hover:text-text-primary hover:bg-[hsl(var(--background-accent))]"
              title="Bold"
              aria-label="Bold"
            >
              <Bold size={16} />
            </button>
            <button
              type="button"
              onClick={() => execCommand('italic')}
              className="rounded p-1 text-text-tertiary hover:text-text-primary hover:bg-[hsl(var(--background-accent))]"
              title="Italic"
              aria-label="Italic"
            >
              <Italic size={16} />
            </button>
          </div>

          {/* Rich text editor */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
            data-placeholder={
              companyUsers.length > 0
                ? "Write a post... type @ to mention someone"
                : 'Write a post...'
            }
            data-empty="true"
            className="min-h-[60px] w-full resize-none border-0 bg-transparent text-base text-text-primary outline-none focus:ring-0 [overflow-wrap:anywhere]"
          />

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {attachments.map(att => (
                <div key={att.id} className="relative group">
                  {att.fileType === 'IMAGE' ? (
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="h-20 w-20 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border bg-[hsl(var(--background-accent))]">
                      {getFileIcon(att.fileType)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-1 -right-1 rounded-full bg-red p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    title="Remove attachment"
                    aria-label="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                  {att.fileType !== 'IMAGE' && (
                    <p className="mt-1 text-xs text-text-tertiary truncate max-w-[80px]">
                      {att.fileName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer: actions */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor={`file-upload-${jobId}`}
                className={clsx(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary',
                  isUploading && 'opacity-50 pointer-events-none'
                )}
                title="Attach files"
              >
                {isUploading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Paperclip size={16} />
                )}
                <span>Attach</span>
              </label>
              <input
                id={`file-upload-${jobId}`}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={e => handleFileSelect(e.target.files!)}
                ref={fileInputRef}
                disabled={isUploading}
              />

              <div
                className="hidden sm:flex items-center text-xs text-text-tertiary"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                Drag & drop files anywhere to upload
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              rightIcon={<Send size={16} />}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              Post
            </Button>
          </div>
        </div>
      </div>

      {/* Mention dropdown */}
      {showMentionDropdown && (
        <div
          ref={mentionDropdownRef}
          className="fixed z-50 w-64 max-h-[240px] overflow-y-auto rounded-lg border border-border bg-[hsl(var(--background-card))] shadow-xl"
          style={{ left: mentionDropdownPos.x, top: mentionDropdownPos.y }}
        >
          <div className="p-2 text-xs font-medium uppercase text-text-tertiary">
            Mention{mentionQuery && ` "${mentionQuery}"`}
          </div>
          {filteredUsers.length === 0 ? (
            <div className="p-3 text-sm text-text-tertiary">
              No matching users
            </div>
          ) : (
            filteredUsers.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[hsl(var(--background-accent))]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold text-xs">
                  {getUserInitials(u)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-text-primary">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {roleLabel(u.role)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── FeedPostItem ────────────────────────────────────────────

interface FeedPostItemProps {
  post: FeedPost;
  onReply: (postId: string) => void;
  onDelete: (postId: string) => void;
  currentUserId?: string;
}

const FeedPostItem: React.FC<FeedPostItemProps> = ({
  post,
  onReply,
  onDelete,
  currentUserId,
}) => {
  const isOwnPost = post.userId === currentUserId;
  const isSystem = post.isSystem === true;
  const displayName = post.user
    ? `${post.user.firstName} ${post.user.lastName || ''}`
    : 'System';

  return (
    <div
      className={clsx(
        'group relative mb-4 rounded-lg border p-4 transition-colors',
        isSystem
          ? 'border-border bg-[hsl(var(--background-accent))]/30'
          : 'border-border bg-[hsl(var(--background-card))]'
      )}
    >
      <div className="flex gap-3">
        {/* Avatar / system icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          {isSystem ? (
            <Shield size={18} className="text-teal" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold text-xs"
              style={{
                width: USER_AVATAR_SIZE,
                height: USER_AVATAR_SIZE,
              }}
            >
              {post.user ? getUserInitials(post.user) : <UserIcon size={16} />}
            </div>
          )}
        </div>

        <div className="flex-1">
          {/* Post header */}
          <div className="flex items-center gap-2 mb-2">
            {isSystem ? (
              <>
                <span className="font-medium text-teal">System</span>
                <Badge variant="info" size="sm">
                  System
                </Badge>
              </>
            ) : (
              <>
                <span className="font-medium text-text-primary">
                  {displayName}
                </span>
                {post.user && (
                  <Badge variant="default" size="sm">
                    {roleLabel(post.user.role)}
                  </Badge>
                )}
              </>
            )}
            <span className="text-xs text-text-tertiary">
              <Clock size={12} className="inline mr-1" />
              {formatTime(post.createdAt)}
            </span>
          </div>

          {/* Post content with mention highlighting */}
          <div className="mb-2 text-sm text-text-primary [overflow-wrap:anywhere]">
            {renderContentWithMentions(post.content, post.mentions)}
          </div>

          {/* Attachments */}
          {post.attachments && post.attachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-3">
              {post.attachments.map(att => (
                <div key={att.id} className="attachment-preview">
                  {att.fileType === 'IMAGE' ? (
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={att.fileUrl}
                        alt={att.fileName}
                        className="h-24 w-24 rounded-lg object-cover border border-border transition-transform hover:scale-105"
                      />
                    </a>
                  ) : (
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-20 w-24 items-center gap-2 rounded-lg border border-border bg-[hsl(var(--background-accent))] p-2 text-sm text-text-primary hover:bg-[hsl(var(--background-accent))]/80"
                    >
                      {getFileIcon(att.fileType)}
                      <span className="truncate text-xs">
                        {att.fileName}
                      </span>
                    </a>
                  )}
                  <p className="mt-1 text-xs text-text-tertiary">
                    {formatFileSize(att.size)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Post actions */}
          <div className="flex items-center gap-4 border-t border-border pt-2 text-xs text-text-tertiary">
            {!isSystem && (
              <button
                onClick={() => onReply(post.id)}
                className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary"
                aria-label={`Reply to ${displayName}`}
              >
                <MessageCircle size={14} />
                <span>Reply</span>
              </button>
            )}

            {(isOwnPost || isSystem) && (
              <button
                onClick={() => onDelete(post.id)}
                className="flex items-center gap-1.5 text-text-secondary hover:text-red"
                aria-label={`Delete post by ${displayName}`}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {post.replies && post.replies.length > 0 && (
        <div className="mt-3 border-l-2 border-border pl-4 ml-1">
          {post.replies.map(reply => (
            <FeedPostItem
              key={reply.id}
              post={reply}
              onReply={onReply}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── ReplyComposer ──────────────────────────────────────────

interface ReplyComposerProps {
  parentId: string;
  jobId: string;
  onReplied: (reply: FeedPost) => void;
}

const ReplyComposer: React.FC<ReplyComposerProps> = ({
  parentId,
  jobId,
  onReplied,
}) => {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReply = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/feed/${jobId}/posts/${parentId}/reply`, {
        content: content.trim(),
      });

      const newReply: FeedPost = res.data.post || res.data;
      setContent('');
      onReplied(newReply);
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 flex gap-2">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-xs"
        style={{ width: 24, height: 24 }}
      >
        {getUserInitials(user ? { firstName: user.firstName, lastName: user.lastName } : undefined)}
      </div>
      <div className="flex-1">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write a reply..."
          rows={2}
          className="w-full resize-y rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="mt-1 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<Send size={14} />}
            isLoading={isSubmitting}
            disabled={isSubmitting || !content.trim()}
            onClick={handleSubmitReply}
          >
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main JobFeed Component ──────────────────────────────────

const JobFeed: React.FC<{ jobId: string }> = ({ jobId }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  // ── Initial fetch via useQuery ──

  const { data, error } = useQuery({
    queryKey: ['jobFeed', jobId],
    queryFn: () =>
      api
        .get(`/feed/${jobId}/posts`)
        .then(res => res.data?.posts ?? res.data),
    staleTime: 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    if (data) {
      setPosts(data || []);
    }
    setIsLoading(false);
  }, [data]);

  // ── Socket.IO real-time updates ──

  useEffect(() => {
    if (!socket) return;

    // Join the job room to receive feed events
    socket.joinJob(jobId);

    const handleNewPost = (post: FeedPost) => {
      setPosts(prev => {
        // Deduplicate: skip if post already exists
        const exists = prev.some(p => p.id === post.id) ||
          prev.some(p => p.replies?.some(r => r.id === post.id));
        if (exists) return prev;

        if (post.parentPostId) {
          // It's a reply — append to the parent post's replies
          return prev.map(p => {
            if (p.id === post.parentPostId) {
              return {
                ...p,
                replies: [...(p.replies || []), post],
              };
            }
            return p;
          });
        }

        // Top-level post — prepend
        return [post, ...prev];
      });
    };

    const handleNewReply = (payload: { parentId: string; reply: FeedPost }) => {
      setPosts(prev =>
        prev.map(p => {
          if (p.id === payload.parentId) {
            const replies = p.replies || [];
            // Deduplicate reply
            if (replies.some(r => r.id === payload.reply.id)) {
              return p;
            }
            return {
              ...p,
              replies: [...replies, payload.reply],
            };
          }
          return p;
        })
      );
    };

    const handlePostDeleted = (payload: { postId: string }) => {
      setPosts(prev =>
        prev
          .map(p => {
            // Remove the deleted post and any replies to it
            if (p.id === payload.postId) return null;
            return {
              ...p,
              replies: (p.replies || []).filter(r => r.id !== payload.postId),
            };
          })
          .filter(Boolean) as FeedPost[]
      );
    };

    socket.on('feed.new_post', handleNewPost);
    socket.on('feed.new_reply', handleNewReply);
    socket.on('feed.post_deleted', handlePostDeleted);

    return () => {
      socket.off('feed.new_post', handleNewPost);
      socket.off('feed.new_reply', handleNewReply);
      socket.off('feed.post_deleted', handlePostDeleted);
      socket.leaveJob(jobId);
    };
  }, [socket, jobId]);

  // ── Mutations ──

  const handlePostCreated = (post: FeedPost) => {
    // Optimistically add the post (socket will also fire, but deduplication handles it)
    setPosts(prev =>
      prev.some(p => p.id === post.id) ? prev : [post, ...prev]
    );
    queryClient.invalidateQueries({ queryKey: ['jobFeed', jobId] });
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(prev =>
      prev
        .map(p => {
          if (p.id === postId) return null;
          return {
            ...p,
            replies: (p.replies || []).filter(r => r.id !== postId),
          };
        })
        .filter(Boolean) as FeedPost[]
    );
  };

  const handleReplyCreated = (reply: FeedPost) => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id === reply.parentPostId) {
          return {
            ...p,
            replies: [...(p.replies || []), reply],
          };
        }
        // Also check nested replies (unlikely, but safe)
        return p;
      })
    );
    setReplyToId(null);
    queryClient.invalidateQueries({ queryKey: ['jobFeed', jobId] });
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post?')) return;

    try {
      await api.delete(`/feed/${jobId}/posts/${postId}`);
      handlePostDeleted(postId);
    } catch {
      toast.error('Failed to delete post');
    }
  };

  // ── Render ──

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="border-b border-border p-4">
          <div className="animate-pulse">
            <div className="h-4 w-3/4 rounded bg-[hsl(var(--background-accent))] mb-2"></div>
            <div className="h-4 w-1/2 rounded bg-[hsl(var(--background-accent))]"></div>
          </div>
        </div>
        <div className="text-center py-8 text-text-tertiary">
          <Clock size={40} className="mx-auto mb-2 opacity-50" />
          <p>Loading job feed...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red">
        <p>Failed to load the job feed. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Post composer (always at top) */}
      <PostComposer jobId={jobId} onPostCreated={handlePostCreated} />

      {/* Feed content */}
      <div className="flex-1 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary">
            <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-2">No posts yet — be the first to start the conversation.</p>
            <p className="text-sm">Type a message or mention someone with @{user?.firstName || 'someone'}.</p>
          </div>
        ) : (
          <div className="p-4 space-y-0">
            {posts.map(post => (
              <FeedPostItem
                key={post.id}
                post={post}
                onReply={setReplyToId}
                onDelete={handleDeletePost}
                currentUserId={user?.id}
              />
            ))}
          </div>
        )}

        {/* Inline reply composer */}
        {replyToId && (
          <div className="border-t border-border p-4">
            <ReplyComposer
              parentId={replyToId}
              jobId={jobId}
              onReplied={handleReplyCreated}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default JobFeed;

// Re-export for convenience
export type { JobFeedProps };
interface JobFeedProps {
  jobId: string;
}
