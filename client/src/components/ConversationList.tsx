import { useState, useEffect, useRef } from "react";
import type { Conversation, User } from "../types";
import { searchUsers, createDirect } from "../api/conversations";
import { CreateGroupModal } from "./CreateGroupModal";

interface Props {
  conversations: Conversation[];
  selectedId: number | null;
  currentUserId: number;
  token: string;
  unread: Set<number>;
  onSelect: (id: number) => void;
  onCreated: (convId: number) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  token,
  unread,
  onSelect,
  onCreated,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      searchUsers(token, query.trim())
        .then((users) =>
          setResults(users.filter((u) => u.id !== currentUserId)),
        )
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, currentUserId]);

  async function handleStartChat(userId: number) {
    const conv = await createDirect(token, userId);
    setQuery("");
    setResults([]);
    onCreated(conv.id);
  }

  const showResults = query.trim().length >= 2;

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Messages</span>
          <button
            className="new-group-btn"
            onClick={() => setShowGroupModal(true)}
            title="New group"
            data-testid="new-group-btn"
          >
            ✎
          </button>
        </div>

        <div className="search-wrap">
          <input
            type="text"
            placeholder="🔍  Search people to chat…"
            value={query}
            data-testid="search-input"
            className="search-input"
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && <span className="search-spinner">…</span>}
        </div>

        {showResults && (
          <ul className="search-results" data-testid="search-results">
            {results.length === 0 && !searching && (
              <li className="search-empty">No users found</li>
            )}
            {results.map((u) => (
              <li key={u.id}>
                <button onClick={() => void handleStartChat(u.id)}>
                  <span className="avatar">{u.username[0].toUpperCase()}</span>
                  <span>{u.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!showResults && (
          <ul className="conv-list">
            {conversations.length === 0 && (
              <li className="conv-empty">
                Search above to find someone and start a conversation.
              </li>
            )}

            {/* Message requests (pending) */}
            {conversations
              .filter((c) => c.my_status === "pending")
              .map((c) => (
                <li key={c.id}>
                  <button
                    className={`conv-item conv-item-request${c.id === selectedId ? " active" : ""}`}
                    onClick={() => onSelect(c.id)}
                  >
                    <span className="avatar avatar-request">
                      {(c.display_name ?? c.name ?? "G")[0].toUpperCase()}
                    </span>
                    <div className="conv-meta">
                      <span className="conv-name">
                        {c.display_name ?? c.name ?? "Group"}
                      </span>
                      <span className="conv-request-label">
                        Message request
                      </span>
                    </div>
                    <span className="unread-dot" data-testid="unread-dot" />
                  </button>
                </li>
              ))}

            {/* Active conversations */}
            {conversations
              .filter((c) => c.my_status !== "pending")
              .map((c) => {
                const hasUnread = unread.has(c.id);
                const isActive = c.id === selectedId;
                const className = [
                  "conv-item",
                  isActive ? "active" : "",
                  hasUnread && !isActive ? "unread" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li key={c.id}>
                    <button
                      className={className}
                      onClick={() => onSelect(c.id)}
                    >
                      <span
                        className={`avatar${hasUnread && !isActive ? " avatar-unread" : ""}`}
                      >
                        {(c.display_name ?? c.name ?? "G")[0].toUpperCase()}
                      </span>
                      <span className="conv-name">
                        {c.display_name ?? c.name ?? "Group"}
                      </span>
                      {hasUnread && !isActive && (
                        <span className="unread-dot" data-testid="unread-dot" />
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </aside>

      {showGroupModal && (
        <CreateGroupModal
          token={token}
          currentUserId={currentUserId}
          onCreated={(convId) => {
            setShowGroupModal(false);
            onCreated(convId);
          }}
          onClose={() => setShowGroupModal(false)}
        />
      )}
    </>
  );
}
