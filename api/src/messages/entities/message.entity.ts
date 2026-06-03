export type ContentType = 'text' | 'system';

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  content_type: ContentType;
  reply_to_id: number | null;
  is_deleted: boolean;
  deleted_at: Date | null;
  created_at: Date;
}

export interface MessageResponse extends Message {
  username: string;
  avatar_url: string | null;
  read_count: number;
}
