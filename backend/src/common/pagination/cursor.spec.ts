import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CursorQueryDto,
  decodeCursor,
  encodeCursor,
  toCursorPage,
} from './cursor';

const b64 = (text: string) => Buffer.from(text).toString('base64url');

describe('cursor pagination', () => {
  it('round-trips an id through an opaque cursor', () => {
    const cursor = encodeCursor(12345);

    expect(cursor).not.toContain('12345');
    expect(decodeCursor(cursor)).toBe(12345);
  });

  it('means "from the start" when there is no cursor', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it.each(['', 'abc', b64('-5'), b64('1.5'), b64('99999999999999999999')])(
    'rejects the cursor %j that this server did not issue',
    (cursor) => {
      expect(() => decodeCursor(cursor)).toThrow(BadRequestException);
    },
  );

  describe('toCursorPage', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it('uses the extra row to know there is a next page, and drops it', () => {
      const page = toCursorPage(rows, 2);

      expect(page.items).toEqual([{ id: 1 }, { id: 2 }]);
      expect(page.nextCursor).toBe(encodeCursor(2));
    });

    it('has no next cursor when the page is not full', () => {
      expect(toCursorPage(rows, 3).nextCursor).toBeNull();
      expect(toCursorPage(rows.slice(0, 1), 5).nextCursor).toBeNull();
    });

    it('handles an empty result', () => {
      expect(toCursorPage([], 20)).toEqual({ items: [], nextCursor: null });
    });
  });

  describe('query validation', () => {
    const check = (plain: object) =>
      validate(plainToInstance(CursorQueryDto, plain));

    it('defaults the limit to 20 and accepts a cursor', async () => {
      expect(plainToInstance(CursorQueryDto, {}).limit).toBe(20);
      expect(await check({ limit: '50', cursor: encodeCursor(9) })).toEqual([]);
    });

    it('rejects a limit out of range and a cursor with odd characters', async () => {
      expect(await check({ limit: '0' })).not.toEqual([]);
      expect(await check({ limit: '101' })).not.toEqual([]);
      expect(await check({ cursor: 'a b/c' })).not.toEqual([]);
      expect(await check({ cursor: 'x'.repeat(40) })).not.toEqual([]);
    });
  });
});
