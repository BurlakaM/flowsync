import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** More matches than this are cut off: nobody reads further, and the list is built in memory. */
const MAX_MATCHES = 1000;
const MAX_TERMS = 10;

/**
 * Turns what the user typed into a tsquery: every word must match, and each one as a prefix
 * ("log" finds "login"). Only letters and digits survive, so the text can never inject tsquery
 * syntax. Returns null when nothing searchable is left (for example "!!!").
 */
export function buildTsQuery(search: string): string | null {
  const terms = search
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_TERMS);
  return terms.length > 0 ? terms.map((term) => `${term}:*`).join(' & ') : null;
}

// Identical to the expression of the index "tasks_fts_idx" (see the migration), or it is not used.
const taskDocument = Prisma.sql`(
  setweight(to_tsvector('simple', t."name"), 'A') ||
  setweight(to_tsvector('simple', coalesce(t."description", '')), 'B')
)`;

/** Full-text search over the name, the description and the comments of tasks. */
@Injectable()
export class TasksSearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ids of the tasks that match, best match first (a hit in the name outweighs one in the description),
   * among the tasks of `projectIds` only. The caller passes the projects the user may see, so the
   * limit of 1000 matches applies to tasks the user can read, not to the whole database.
   *
   * The two sources of a hit (the task itself, its comments) are two separate branches joined by UNION:
   * each is answered by its own GIN index. Written as one condition with OR, the planner cannot use the
   * index of the tasks and reads and re-parses every task (measured: 744 ms against 180 ms on 60 000 tasks,
   * see docs/PERFORMANCE.md).
   */
  async rankedIds(search: string, projectIds: number[]): Promise<number[]> {
    const query = buildTsQuery(search);
    if (!query || projectIds.length === 0) return [];

    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      WITH q AS (SELECT to_tsquery('simple', ${query}) AS query),
      hits AS (
        SELECT t."id" FROM "tasks" t, q WHERE ${taskDocument} @@ q.query
        UNION
        SELECT c."task_id" FROM "comments" c, q
        WHERE to_tsvector('simple', c."text") @@ q.query
      )
      SELECT t."id"
      FROM hits h
      JOIN "tasks" t ON t."id" = h."id"
      CROSS JOIN q
      WHERE t."project_id" = ANY(${projectIds}::int[])
      ORDER BY ts_rank(${taskDocument}, q.query) DESC, t."id" DESC
      LIMIT ${MAX_MATCHES}`;
    return rows.map((row) => row.id);
  }
}
