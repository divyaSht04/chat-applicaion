import axios from "axios";
import type { Conversation, ConversationMember, User } from "../types";

const BASE = import.meta.env.VITE_API_URL as string;

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getConversations(token: string): Promise<Conversation[]> {
  const { data } = await axios.get<Conversation[]>(`${BASE}/conversations`, {
    headers: authHeader(token),
  });
  return data;
}

export async function createDirect(
  token: string,
  recipientId: number,
): Promise<Conversation> {
  const { data } = await axios.post<Conversation>(
    `${BASE}/conversations/direct`,
    { recipientId },
    { headers: authHeader(token) },
  );
  return data;
}

export async function createGroup(
  token: string,
  name: string,
): Promise<Conversation> {
  const { data } = await axios.post<Conversation>(
    `${BASE}/conversations/group`,
    { name },
    { headers: authHeader(token) },
  );
  return data;
}

export async function inviteMember(
  token: string,
  conversationId: number,
  userId: number,
): Promise<void> {
  await axios.post(
    `${BASE}/conversations/${conversationId}/members`,
    { userId },
    { headers: authHeader(token) },
  );
}

export async function searchUsers(token: string, q: string): Promise<User[]> {
  const { data } = await axios.get<User[]>(`${BASE}/users/search`, {
    params: { q },
    headers: authHeader(token),
  });
  return data;
}

export async function acceptConversation(
  token: string,
  id: number,
): Promise<void> {
  await axios.patch(
    `${BASE}/conversations/${id}/members/me`,
    { status: "accepted" },
    { headers: authHeader(token) },
  );
}

export async function declineConversation(
  token: string,
  id: number,
): Promise<void> {
  await axios.patch(
    `${BASE}/conversations/${id}/members/me`,
    { status: "rejected" },
    { headers: authHeader(token) },
  );
}

export async function leaveConversation(
  token: string,
  id: number,
): Promise<void> {
  await axios.delete(`${BASE}/conversations/${id}/members/me`, {
    headers: authHeader(token),
  });
}

export async function deleteConversation(
  token: string,
  id: number,
): Promise<void> {
  await axios.delete(`${BASE}/conversations/${id}`, {
    headers: authHeader(token),
  });
}

export async function getMembers(
  token: string,
  id: number,
): Promise<ConversationMember[]> {
  const { data } = await axios.get<ConversationMember[]>(
    `${BASE}/conversations/${id}/members`,
    { headers: authHeader(token) },
  );
  return data;
}

export async function removeGroupMember(
  token: string,
  conversationId: number,
  userId: number,
): Promise<void> {
  await axios.delete(
    `${BASE}/conversations/${conversationId}/members/${userId}`,
    { headers: authHeader(token) },
  );
}
