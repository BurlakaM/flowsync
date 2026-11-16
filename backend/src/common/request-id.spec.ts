import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveRequestId } from './request-id';

const run = (header?: string | string[]) => {
  const setHeader = vi.fn();
  const id = resolveRequestId(
    { headers: { 'x-request-id': header } } as unknown as IncomingMessage,
    { setHeader } as unknown as ServerResponse,
  );
  return { id, setHeader };
};

describe('resolveRequestId', () => {
  it('keeps a well-formed incoming id and echoes it in the response', () => {
    const { id, setHeader } = run('abc-123_X.y');

    expect(id).toBe('abc-123_X.y');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc-123_X.y');
  });

  it('generates a UUID when there is no id', () => {
    const { id, setHeader } = run(undefined);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', id);
  });

  it('replaces an id with unexpected characters or an excessive length', () => {
    expect(run('bad id\r\nX-Evil: 1').id).toMatch(/^[0-9a-f-]{36}$/);
    expect(run('a'.repeat(65)).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uses the first value when the header is repeated', () => {
    expect(run(['first', 'second']).id).toBe('first');
  });
});
