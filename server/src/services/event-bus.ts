export type Handler<T> = (message: T) => void | Promise<void>;

/** In-process pub/sub. A throwing handler never stops the others. */
export class EventBus<T> {
  private readonly handlers = new Set<Handler<T>>();

  constructor(private readonly onError: (error: unknown) => void = () => {}) {}

  /** Returns an unsubscribe function. */
  subscribe(handler: Handler<T>): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Resolves once every handler has finished. */
  async publish(message: T): Promise<void> {
    const results = await Promise.allSettled(
      [...this.handlers].map(async (handler) => handler(message)),
    );
    for (const result of results) {
      if (result.status === 'rejected') this.onError(result.reason);
    }
  }
}
