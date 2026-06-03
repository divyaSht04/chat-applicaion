import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import {
  getConversations,
  acceptConversation,
  declineConversation,
  leaveConversation,
  deleteConversation,
} from "../api/conversations";
import { ConversationList } from "../components/ConversationList";
import { ChatWindow } from "../components/ChatWindow";
import { ManageMembersModal } from "../components/ManageMembersModal";
import type { Conversation, Message } from "../types";

export function ChatPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket(token);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unread, setUnread] = useState<Set<number>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  // Ref to the scrollable messages container — used to restore scroll position after prepend
  const messagesAreaRef = useRef<HTMLDivElement | null>(null);
  // Ref so the socket-connect effect can read the latest selectedId without
  // needing to re-run every time selectedId changes
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  });

  function loadConversations(t: string) {
    getConversations(t)
      .then(setConversations)
      .catch(() => undefined);
  }

  useEffect(() => {
    if (!token) {
      void navigate("/login");
      return;
    }
    loadConversations(token);
  }, [token, navigate]);

  // When socket (re-)connects and a conversation is already selected,
  // join its room so message history loads immediately
  useEffect(() => {
    if (!socket || selectedIdRef.current === null) return;
    socket.emit("joinRoom", { roomId: selectedIdRef.current });
  }, [socket]);  

  useEffect(() => {
    if (!socket) return;

    const onHistory = ({
      messages: msgs,
      hasMore: more,
    }: {
      messages: Message[];
      hasMore: boolean;
    }) => {
      setMessages(msgs);
      setHasMore(more);
      setLoadingMore(false);
    };
    const onOlderMessages = ({
      messages: older,
      hasMore: more,
    }: {
      messages: Message[];
      hasMore: boolean;
    }) => {
      const el = messagesAreaRef.current;
      const prevHeight = el?.scrollHeight ?? 0;
      setMessages((prev) => [...older, ...prev]);
      setHasMore(more);
      setLoadingMore(false);
      // Restore scroll position so the viewport doesn't jump
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    };
    const onNew = (msg: Message) => {
      setMessages((prev) =>
        msg.conversation_id === selectedId ? [...prev, msg] : prev,
      );
      // Bubble the conversation to the top of the sidebar list
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversation_id);
        if (idx <= 0) return prev;
        const next = [...prev];
        next.unshift(next.splice(idx, 1)[0]);
        return next;
      });
      // Mark unread for any conversation that isn't currently open
      if (msg.conversation_id !== selectedId) {
        setUnread((prev) => new Set([...prev, msg.conversation_id]));
      }
    };
    const onConversationCreated = () => {
      if (token) loadConversations(token);
    };
    const onConversationDeleted = ({
      conversationId,
    }: {
      conversationId: number;
    }) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setSelectedId((prev) => (prev === conversationId ? null : prev));
      setMessages((prev) => (selectedId === conversationId ? [] : prev));
    };
    const onRemovedFromConversation = ({
      conversationId,
    }: {
      conversationId: number;
    }) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setSelectedId((prev) => (prev === conversationId ? null : prev));
      setMessages((prev) => (selectedId === conversationId ? [] : prev));
    };

    socket.on("messageHistory", onHistory);
    socket.on("olderMessages", onOlderMessages);
    socket.on("newMessage", onNew);
    socket.on("conversationCreated", onConversationCreated);
    socket.on("conversationDeleted", onConversationDeleted);
    socket.on("removedFromConversation", onRemovedFromConversation);
    return () => {
      socket.off("messageHistory", onHistory);
      socket.off("olderMessages", onOlderMessages);
      socket.off("newMessage", onNew);
      socket.off("conversationCreated", onConversationCreated);
      socket.off("conversationDeleted", onConversationDeleted);
      socket.off("removedFromConversation", onRemovedFromConversation);
    };
  }, [socket, selectedId, token]);

  const selectConversation = useCallback(
    (id: number) => {
      if (selectedId !== null && socket)
        socket.emit("leaveRoom", { roomId: selectedId });
      setSelectedId(id);
      setMessages([]);
      setHasMore(false);
      setLoadingMore(false);
      setUnread((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (socket) socket.emit("joinRoom", { roomId: id });
    },
    [socket, selectedId],
  );

  const loadMore = useCallback(() => {
    if (
      !socket ||
      !selectedId ||
      !hasMore ||
      loadingMore ||
      messages.length === 0
    )
      return;
    setLoadingMore(true);
    socket.emit("loadMoreMessages", {
      roomId: selectedId,
      before: messages[0].id,
    });
  }, [socket, selectedId, hasMore, loadingMore, messages]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!socket || selectedId === null) return;
      socket.emit("sendMessage", { roomId: selectedId, content });
    },
    [socket, selectedId],
  );

  function handleLogout() {
    socket?.disconnect();
    logout();
    void navigate("/login");
  }

  const selectedConv = conversations.find((c) => c.id === selectedId);
  const convName = selectedConv?.display_name ?? selectedConv?.name ?? "Group";
  const myStatus = selectedConv?.my_status ?? "accepted";
  const hasPendingMember = selectedConv?.has_pending_member ?? false;
  const isOwner =
    selectedConv?.type === "group" && selectedConv?.created_by === user?.id;

  async function handleAccept() {
    if (!token || !selectedId) return;
    await acceptConversation(token, selectedId);
    loadConversations(token);
  }

  async function handleDecline() {
    if (!token || !selectedId) return;
    await declineConversation(token, selectedId);
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
    setMessages([]);
  }

  async function handleLeave() {
    if (!token || !selectedId) return;
    await leaveConversation(token, selectedId);
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
    setMessages([]);
  }

  async function handleDeleteGroup() {
    if (!token || !selectedId) return;
    await deleteConversation(token, selectedId);
    // server emits 'conversationDeleted' which will clean up other members;
    // clean up locally right away so the UI responds immediately
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
    setMessages([]);
  }

  function handleManageMembers() {
    setShowMembersModal(true);
  }

  if (!token || !user) return null;

  return (
    <div className="chat-layout">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        currentUserId={user.id}
        token={token}
        unread={unread}
        onSelect={selectConversation}
        onCreated={(convId) => {
          loadConversations(token);
          selectConversation(convId);
        }}
      />

      {selectedId ? (
        <ChatWindow
          messages={messages}
          currentUserId={user.id}
          conversationName={convName}
          conversationType={selectedConv?.type ?? "direct"}
          myStatus={myStatus}
          hasPendingMember={hasPendingMember}
          isOwner={isOwner}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onSend={sendMessage}
          onLogout={handleLogout}
          onAccept={() => void handleAccept()}
          onDecline={() => void handleDecline()}
          onLeave={() => void handleLeave()}
          onDelete={() => void handleDeleteGroup()}
          onManageMembers={handleManageMembers}
          onLoadMore={loadMore}
          onMessagesAreaRef={(el) => {
            messagesAreaRef.current = el;
          }}
        />
      ) : (
        <div className="empty-state">
          <p>Select a conversation or search for someone to chat with.</p>
          <button className="logout-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}

      {showMembersModal && selectedId !== null && token && user && (
        <ManageMembersModal
          conversationId={selectedId}
          token={token}
          currentUserId={user.id}
          isOwner={isOwner}
          onClose={() => setShowMembersModal(false)}
        />
      )}
    </div>
  );
}
