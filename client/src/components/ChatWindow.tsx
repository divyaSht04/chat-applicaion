import { useEffect, useRef } from "react";
import type { Message } from "../types";
import { MessageInput } from "./MessageInput";

interface Props {
  messages: Message[];
  currentUserId: number;
  conversationName: string;
  conversationType: "direct" | "group";
  myStatus: "accepted" | "pending";
  hasPendingMember: boolean;
  isOwner: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onSend: (content: string) => void;
  onLogout: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onLeave: () => void;
  onDelete: () => void;
  onManageMembers: () => void;
  onLoadMore: () => void;
  onMessagesAreaRef: (el: HTMLDivElement | null) => void;
}

export function ChatWindow({
  messages,
  currentUserId,
  conversationName,
  conversationType,
  myStatus,
  hasPendingMember,
  isOwner,
  hasMore,
  loadingMore,
  onSend,
  onLogout,
  onAccept,
  onDecline,
  onLeave,
  onDelete,
  onManageMembers,
  onLoadMore,
  onMessagesAreaRef,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement | null>(null);
  // Track the message count from the last initial load so we only auto-scroll
  // to bottom on new messages, not when older messages are prepended
  const lastHistoryLengthRef = useRef(0);

  // Auto-scroll to bottom only when new messages arrive at the end
  useEffect(() => {
    const isInitialLoad =
      lastHistoryLengthRef.current === 0 && messages.length > 0;
    const isNewMessage = messages.length === lastHistoryLengthRef.current + 1;
    if (isInitialLoad || isNewMessage) {
      bottomRef.current?.scrollIntoView({
        behavior: isInitialLoad ? "instant" : "smooth",
      });
    }
    lastHistoryLengthRef.current = messages.length;
  }, [messages]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (e.currentTarget.scrollTop < 60) onLoadMore();
  }

  const isPending = myStatus === "pending";

  return (
    <div className="chat-window">
      <header className="chat-header">
        <span className="chat-header-name">{conversationName}</span>
        <div className="chat-header-actions">
          {!isPending && conversationType === "group" && (
            <button
              className="action-btn"
              onClick={onManageMembers}
              title="Manage members"
            >
              Members
            </button>
          )}
          {!isPending &&
            (isOwner ? (
              <button
                className="action-btn danger-btn"
                onClick={onDelete}
                title="Delete group"
              >
                Delete
              </button>
            ) : (
              <button
                className="action-btn"
                onClick={onLeave}
                title="Leave conversation"
              >
                Leave
              </button>
            ))}
          <button className="logout-btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {isPending && (
        <div className="request-banner" data-testid="request-banner">
          <p className="request-banner-text">
            <strong>{conversationName}</strong> sent you a message request.
          </p>
          <div className="request-banner-actions">
            <button className="accept-btn" onClick={onAccept}>
              Accept
            </button>
            <button className="decline-btn" onClick={onDecline}>
              Decline
            </button>
          </div>
        </div>
      )}

      {!isPending && hasPendingMember && (
        <div className="pending-notice" data-testid="pending-notice">
          Waiting for {conversationName} to accept your message request.
        </div>
      )}

      <div
        className="messages-area"
        data-testid="messages-area"
        ref={(el) => {
          messagesAreaRef.current = el;
          onMessagesAreaRef(el);
        }}
        onScroll={handleScroll}
      >
        {/* Load-older indicator at the very top */}
        {loadingMore && (
          <p className="load-more-spinner" data-testid="load-more-spinner">
            Loading older messages…
          </p>
        )}
        {hasMore && !loadingMore && (
          <button
            className="load-more-btn"
            onClick={onLoadMore}
            data-testid="load-more-btn"
          >
            Load older messages
          </button>
        )}

        {messages.length === 0 && !loadingMore && (
          <p className="no-messages">
            {isPending
              ? "Accept the request to see messages."
              : "No messages yet. Say hello!"}
          </p>
        )}

        {messages.map((msg) => {
          if (msg.content_type === "system") {
            return (
              <div
                key={msg.id}
                className="system-message"
                data-testid="system-message"
              >
                {msg.content}
              </div>
            );
          }
          const isMine = msg.sender_id === currentUserId;
          return (
            <div
              key={msg.id}
              className={`bubble-row ${isMine ? "mine" : "theirs"}`}
              data-testid="message-bubble"
            >
              {!isMine && conversationType === "group" && (
                <span className="bubble-sender">{msg.username}</span>
              )}
              <div
                className={`bubble ${isMine ? "bubble-mine" : "bubble-theirs"}`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSend={onSend}
        disabled={isPending}
        placeholder={isPending ? "Accept the request to reply…" : "Message…"}
      />
    </div>
  );
}
