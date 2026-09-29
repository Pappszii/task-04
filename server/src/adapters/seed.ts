import type { AlertRule, User } from '../domain/index.js';

/** Demo data loaded on every boot. Concrete channel ids are fine here: this is an adapter, not core. */
export function seedUsers(): User[] {
  return [
    {
      id: 'u-alice',
      name: 'Alice',
      role: 'user',
      contacts: { email: 'alice@example.com', slack: '@alice' },
    },
    {
      id: 'u-bob',
      name: 'Bob',
      role: 'user',
      contacts: { email: 'bob@example.com' },
    },
    {
      id: 'u-carol',
      name: 'Carol',
      role: 'user',
      contacts: {},
    },
    {
      id: 'u-admin',
      name: 'Admin',
      role: 'admin',
      contacts: { email: 'admin@example.com', slack: '#ops' },
    },
  ];
}

export function seedRules(): AlertRule[] {
  return [
    {
      id: 'r-alice-quakes',
      userId: 'u-alice',
      name: 'Serious disasters',
      category: 'disasters',
      keywords: [],
      minSeverity: 4,
      channelIds: ['email', 'slack'],
      enabled: true,
    },
    {
      id: 'r-alice-markets',
      userId: 'u-alice',
      name: 'Big ACME moves',
      category: 'markets',
      keywords: [],
      minSeverity: 2,
      symbol: 'ACME',
      minPercentMove: 3,
      channelIds: ['slack'],
      enabled: true,
    },
    {
      id: 'r-bob-news',
      userId: 'u-bob',
      name: 'Election news',
      category: 'news',
      keywords: ['election'],
      minSeverity: 3,
      channelIds: ['email', 'slack'],
      enabled: true,
    },
  ];
}
