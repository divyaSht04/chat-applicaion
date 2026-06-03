import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LoginForm } from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(email: string, password: string) {
    try {
      setError(null);
      await login(email, password);
      void navigate("/chat");
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <LoginForm onSubmit={handleLogin} error={error} />
        <div className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
