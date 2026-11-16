// The Role enum (USER, ADMIN) is defined in prisma/schema.prisma; it is re-exported here so that
// the rest of the application does not import from @prisma/client just for roles.
export { Role } from '@prisma/client';
