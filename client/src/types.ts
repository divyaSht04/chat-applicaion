export interface User {
  id: number;
  username: string;
  avatar_url: string | null;
  email: string;
  role: string;
}

export interface Conversation {
  id: number;
  type: "direct" | "group";
  name: string | null;
  display_name?: string | null;
  created_by: number;
  updated_at: string;
  my_status?: "accepted" | "pending";
  has_pending_member?: boolean;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  content_type?: "text" | "system";
  created_at: string;
  username: string;
}

export interface ConversationMember {
  id: number;
  conversation_id: number;
  user_id: number;
  role: "owner" | "member";
  status: string;
  username: string;
  email: string;
  avatar_url: string | null;
}
