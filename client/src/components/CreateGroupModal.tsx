import { useState, useEffect, useRef } from "react";
import type { User } from "../types";
import { searchUsers, createGroup, inviteMember } from "../api/conversations";

interface Props {
  token: string;
  currentUserId: number;
  onCreated: (convId: number) => void;
  onClose: () => void;
}

export function CreateGroupModal({
  token,
  currentUserId,
  onCreated,
  onClose,
}: Props) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      searchUsers(token, query.trim())
        .then((users) =>
          setResults(
            users.filter(
              (u) =>
                u.id !== currentUserId && !members.find((m) => m.id === u.id),
            ),
          ),
        )
        .catch(() => setResults([]));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, currentUserId, members]);

  function addMember(user: User) {
    setMembers((prev) => [...prev, user]);
    setQuery("");
    setResults([]);
  }

  function removeMember(id: number) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const conv = await createGroup(token, name.trim());
      await Promise.all(members.map((m) => inviteMember(token, conv.id, m.id)));
      onCreated(conv.id);
    } catch {
      setError("Failed to create group. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>New group</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && (
          <p className="auth-error" style={{ padding: "0 16px" }}>
            {error}
          </p>
        )}

        <div className="modal-body">
          <input
            className="modal-input"
            placeholder="Group name"
            value={name}
            data-testid="group-name"
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="modal-input"
            placeholder="Add people…"
            value={query}
            data-testid="group-search"
            onChange={(e) => setQuery(e.target.value)}
          />

          {results.length > 0 && (
            <ul className="search-results modal-search-results">
              {results.map((u) => (
                <li key={u.id}>
                  <button onClick={() => addMember(u)}>
                    <span className="avatar sm">
                      {u.username[0].toUpperCase()}
                    </span>
                    <span>{u.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {members.length > 0 && (
            <div className="selected-members">
              {members.map((m) => (
                <span key={m.id} className="member-chip">
                  {m.username}
                  <button onClick={() => removeMember(m.id)}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="modal-create-btn"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
