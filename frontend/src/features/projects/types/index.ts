import type { UserSummary } from '@/types/api';

export type ProjectRole = 'OWNER' | 'MEMBER';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  ownerId: number;
  /** The role of the signed-in user in this project. */
  myRole: ProjectRole;
  tasksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  userId: number;
  name: string;
  email: string;
  role: ProjectRole;
  joinedAt: string;
}

export interface ProjectDetails extends Project {
  owner: UserSummary;
  members: Member[];
}

export interface ProjectInput {
  name: string;
  description: string;
}

export interface ProjectListParams {
  search?: string;
  page?: number;
  limit?: number;
}
