export type MemberStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'left'
  | 'removed';
export type MemberRole = 'owner' | 'member';

export interface ConversationMember {
  id: number;
  conversation_id: number;
  user_id: number;
  role: MemberRole;
  status: MemberStatus;
  invited_by: number | null;
  joined_at: Date | null;
  created_at: Date;
}
