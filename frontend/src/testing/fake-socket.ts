type Handler = (...args: unknown[]) => void;

/** A stand-in for the socket.io client: tests push server messages into it with `receive`. */
export class FakeSocket {
  private handlers = new Map<string, Handler[]>();
  connectCalls = 0;
  disconnected = false;

  on(event: string, handler: Handler): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  connect(): this {
    this.connectCalls += 1;
    return this;
  }

  disconnect(): this {
    this.disconnected = true;
    return this;
  }

  /** What the server would send. */
  receive(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}

/** Every socket the application created in the current test, oldest first. */
export const fakeSockets: FakeSocket[] = [];

export function createFakeSocket(): FakeSocket {
  const socket = new FakeSocket();
  fakeSockets.push(socket);
  return socket;
}
