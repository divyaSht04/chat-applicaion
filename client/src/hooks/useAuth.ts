import { useState, useCallback } from "react";
import { login as apiLogin, register as apiRegister } from "../api/auth";
import type { User } from "../types";

const TOKEN_KEY = "chat_token";
const USER_KEY = "chat_user";

export interface AuthState {
  token: string | null;
  user: User | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    const user = raw ? (JSON.parse(raw) as User) : null;
    return { token, user };
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setState({ token: res.access_token, user: res.user });
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const res = await apiRegister(username, email, password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setState({ token: res.access_token, user: res.user });
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null });
  }, []);

  return { ...state, login, register, logout };
}
