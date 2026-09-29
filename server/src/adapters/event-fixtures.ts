import type { EventFixture } from './fixture-event-source.js';

// Written to line up with the seeded rules in seed.ts: some fixtures trigger a rule, some are noise.

export const disasterFixtures: EventFixture[] = [
  {
    category: 'disasters',
    title: 'Magnitude 6.9 earthquake strikes off the Pacific coast',
    summary: 'A tsunami watch has been issued for low-lying coastal areas.',
    severity: 5,
    tags: ['earthquake', 'tsunami', 'pacific'],
  },
  {
    category: 'disasters',
    title: 'Minor tremor felt in inland region',
    summary: 'No damage reported after a magnitude 3.1 tremor.',
    severity: 2,
    tags: ['earthquake'],
  },
  {
    category: 'disasters',
    title: 'Wildfire forces evacuations in the northern hills',
    summary: 'Several thousand residents have been told to leave as winds pick up.',
    severity: 4,
    tags: ['wildfire', 'evacuation'],
  },
  {
    category: 'disasters',
    title: 'Flood warning issued for the river valley',
    summary: 'Water levels are expected to peak overnight.',
    severity: 3,
    tags: ['flood'],
  },
];

export const marketFixtures: EventFixture[] = [
  {
    category: 'markets',
    title: 'ACME shares plunge after earnings miss',
    summary: 'ACME fell sharply in early trading after missing quarterly estimates.',
    severity: 3,
    tags: ['earnings'],
    symbol: 'ACME',
    percentChange: -4.8,
  },
  {
    category: 'markets',
    title: 'ACME edges higher on light volume',
    summary: 'ACME closed marginally up in a quiet session.',
    severity: 1,
    tags: [],
    symbol: 'ACME',
    percentChange: 0.6,
  },
  {
    category: 'markets',
    title: 'GLOBEX surges on acquisition report',
    summary: 'GLOBEX jumped after reports of a takeover approach.',
    severity: 4,
    tags: ['acquisition'],
    symbol: 'GLOBEX',
    percentChange: 7.2,
  },
  {
    category: 'markets',
    title: 'ACME rebounds as analysts upgrade the stock',
    summary: 'ACME recovered part of last week\'s losses.',
    severity: 2,
    tags: ['upgrade'],
    symbol: 'ACME',
    percentChange: 3.4,
  },
];

export const newsFixtures: EventFixture[] = [
  {
    category: 'news',
    title: 'Election results tighten as final districts report',
    summary: 'The race is too close to call with a handful of districts outstanding.',
    severity: 3,
    tags: ['election', 'politics'],
  },
  {
    category: 'news',
    title: 'City council approves new transit budget',
    summary: 'The budget funds two new bus routes.',
    severity: 2,
    tags: ['local'],
  },
  {
    category: 'news',
    title: 'Snap vote called after coalition collapses',
    summary: 'The government has called an early election following the walkout.',
    severity: 4,
    tags: ['election', 'politics'],
  },
  {
    category: 'news',
    title: 'Tech company unveils its latest phone',
    summary: 'The new model ships next month.',
    severity: 1,
    tags: ['technology'],
  },
];
