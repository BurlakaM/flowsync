import type { Schemas } from '@/types/api';

export type Project = Schemas['ProjectResponseDto'];
export type ProjectDetails = Schemas['ProjectDetailsDto'];
export type Member = Schemas['MemberResponseDto'];
export type ProjectRole = Project['myRole'];

/** What the project form always sends: the API treats the description as optional, the form as empty text. */
export type ProjectInput = Required<
  Pick<Schemas['CreateProjectDto'], 'name' | 'description'>
>;

export interface ProjectListParams {
  search?: string;
  page?: number;
  limit?: number;
}
