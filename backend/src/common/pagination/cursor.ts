import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * Query parameters of cursor-paginated lists: ?limit=20&cursor=<opaque>.
 *
 * Offset pagination (`page`/`skip`) re-reads and throws away every skipped row and shifts when rows
 * arrive while the user pages: for a feed that grows all the time that means repeats and gaps. A cursor
 * says "continue after this row" and is answered by one index range scan, however deep the page is.
 */
export class CursorQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /** The `nextCursor` of the previous page. Opaque: do not build or parse it. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,32}$/, { message: 'cursor is not valid' })
  cursor?: string;
}

export interface CursorPage<T> {
  items: T[];
  /** Null on the last page. There is deliberately no total: counting every row is what we avoid. */
  nextCursor: string | null;
}

/** The cursor is the id of the last row of a page (ids grow with time), wrapped so clients do not depend on it. */
export const encodeCursor = (id: number): string =>
  Buffer.from(String(id)).toString('base64url');

/** Throws 400 for anything this server did not produce. */
export function decodeCursor(cursor: string | undefined): number | undefined {
  if (cursor === undefined) return undefined;
  const text = Buffer.from(cursor, 'base64url').toString();
  const id = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(id)) {
    throw new BadRequestException('cursor is not valid');
  }
  return id;
}

/**
 * Cuts the `limit + 1` rows that were fetched down to a page. The extra row only tells whether another
 * page exists, which spares a count query.
 */
export function toCursorPage<T extends { id: number }>(
  rows: T[],
  limit: number,
): CursorPage<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor(last.id) : null,
  };
}
