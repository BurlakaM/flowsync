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
   * Ids of the tasks that match, best match first (a hit in the name outweighs one in the
   * description). It knows nothing about access: the caller filters the ids by the projects
   * the user can see.
   */
  async rankedIds(search: string, projectId?: number): Promise<number[]> {
    const query = buildTsQuery(search);
    if (!query) return [];

    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT t."id"
      FROM "tasks" t, to_tsquery('simple', ${query}) q
      WHERE (
          ${taskDocument} @@ q
          OR EXISTS (
            SELECT 1 FROM "comments" c
            WHERE c."task_id" = t."id" AND to_tsvector('simple', c."text") @@ q
          )
        )
        AND (${projectId ?? null}::int IS NULL OR t."project_id" = ${projectId ?? null}::int)
      ORDER BY ts_rank(${taskDocument}, q) DESC, t."id" DESC
      LIMIT ${MAX_MATCHES}`;
    return rows.map((row) => row.id);
  }
}
