import { useState, useEffect, useRef } from "react";
import type { ConversationMember, User } from "../types";
import {
  getMembers,
  removeGroupMember,
  inviteMember,
  searchUsers,
} from "../api/conversations";

interface Props {
  conversationId: number;
  token: string;
  currentUserId: number;
  isOwner: boolean;
  onClose: () => void;
}

export function ManageMembersModal({
  conversationId,
  token,
  currentUserId,
  isOwner,
  onClose,
}: Props) {
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadMembers() {
    getMembers(token, conversationId)
      .then(setMembers)
      .catch(() => undefined);
  }

  useEffect(() => {
    loadMembers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          // Exclude people already in the group
          setResults(
            users.filter((u) => !members.some((m) => m.user_id === u.id)),
          ),
        )
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, members]);

  async function handleAdd(userId: number) {
    await inviteMember(token, conversationId, userId);
    setQuery("");
    setResults([]);
    loadMembers();
  }

  async function handleRemove(userId: number) {
    await removeGroupMember(token, conversationId, userId);
    loadMembers();
  }

  const showSearch = isOwner && query.trim().length >= 2;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Group members</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {isOwner && (
            <div style={{ position: "relative" }}>
              <input
                className="modal-input"
                placeholder="Add people…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                data-testid="member-search-input"
              />
              {searching && <span className="search-spinner">…</span>}
            </div>
          )}

          {showSearch && (
            <div className="modal-search-results">
              {results.length === 0 && !searching && (
                <p
                  style={{
                    padding: "8px 12px",
                    fontSize: 13,
                    color: "#8e8e8e",
                    margin: 0,
                  }}
                >
                  No users found
                </p>
              )}
              {results.map((u) => (
                <button
                  key={u.id}
                  className="member-row"
                  onClick={() => void handleAdd(u.id)}
                >
                  <span className="avatar sm">
                    {u.username[0].toUpperCase()}
                  </span>
                  <span className="member-row-name">{u.username}</span>
                  <span className="member-row-action add-label">Add</span>
                </button>
              ))}
            </div>
          )}

          {!showSearch && (
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.user_id} className="member-row-item">
                  <span className="avatar sm">
                    {m.username[0].toUpperCase()}
                  </span>
                  <div className="member-row-info">
                    <span className="member-row-name">
                      {m.username}
                      {m.user_id === currentUserId && " (you)"}
                    </span>
                    {m.role === "owner" && (
                      <span className="member-role-badge">Owner</span>
                    )}
                  </div>
                  {isOwner &&
                    m.role !== "owner" &&
                    m.user_id !== currentUserId && (
                      <button
                        className="member-row-action remove-label"
                        onClick={() => void handleRemove(m.user_id)}
                      >
                        Remove
                      </button>
                    )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
