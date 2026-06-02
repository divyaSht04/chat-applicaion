export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}
