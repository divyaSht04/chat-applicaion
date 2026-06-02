export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  role: 'user' | 'admin';
  created_at: Date;
  updated_at: Date;
}
