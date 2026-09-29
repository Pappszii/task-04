import { signal } from '@angular/core';

/** Ids with a request in flight, e.g. to disable a row's controls until its save returns. */
export class BusySet {
  private readonly ids = signal<ReadonlySet<string>>(new Set());

  has(id: string): boolean {
    return this.ids().has(id);
  }

  add(id: string): void {
    this.ids.update((ids) => new Set(ids).add(id));
  }

  delete(id: string): void {
    this.ids.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }
}
