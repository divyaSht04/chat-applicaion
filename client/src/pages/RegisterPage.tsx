import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { RegisterForm } from "../components/RegisterForm";
import { useAuth } from "../hooks/useAuth";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(
    username: string,
    email: string,
    password: string,
  ) {
    try {
      setError(null);
      await register(username, email, password);
      void navigate("/chat");
    } catch {
      setError("Registration failed. Username or email may already be taken.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <RegisterForm onSubmit={handleRegister} error={error} />
        <div className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
