import axios from "axios";
import type { User } from "../types";

const BASE = import.meta.env.VITE_API_URL as string;

export interface AuthResponse {
  access_token: string;
  user: User;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${BASE}/auth/login`, {
    email,
    password,
  });
  return data;
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${BASE}/auth/register`, {
    username,
    email,
    password,
  });
  return data;
}
