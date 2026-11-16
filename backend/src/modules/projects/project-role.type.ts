/** The role of a user inside one project (not the global user Role). */
export const ProjectRole = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;

export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];
