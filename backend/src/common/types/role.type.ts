// Role names as they are stored in the `role` table.
// Plan phase 3 replaces the table with a Prisma enum and this type follows it.
export const Role = {
  User: 'user',
  Admin: 'admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
