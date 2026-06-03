import { useState } from "react";

interface Props {
  onSubmit: (email: string, password: string) => Promise<void>;
  error: string | null;
}

export function LoginForm({ onSubmit, error }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(email, password);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1 className="auth-logo">Chatgram</h1>
      <p className="auth-tagline">Sign in to see messages from friends.</p>

      {error && <p className="auth-error">{error}</p>}

      <input
        data-testid="email"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <input
        data-testid="password"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <button data-testid="submit" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}
