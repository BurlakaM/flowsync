import type { UserSummary } from '@/types/api';

export interface Comment {
  id: number;
  text: string;
  taskId: number;
  /** Null when the account of the author was deleted. */
  author: UserSummary | null;
  createdAt: string;
  updatedAt: string;
}
