/**
 * People, projects and tags have no color of their own in the API; one is derived from the id (or the name),
 * so the same thing looks the same everywhere without storing anything. Class names are written out in full
 * because Tailwind only generates the classes it finds in the source.
 */
export interface IdentityColor {
  /** A gradient for round avatars (white initials on top). */
  avatar: string;
  /** A softer, wider gradient for the cover of a project. */
  cover: string;
  /** A tinted background with readable text, for chips such as tags. */
  chip: string;
}

export const IDENTITY_COLORS: readonly IdentityColor[] = [
  {
    avatar: 'from-indigo-500 to-violet-600',
    cover: 'from-indigo-400 via-violet-400 to-fuchsia-300',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200',
  },
  {
    avatar: 'from-sky-500 to-indigo-600',
    cover: 'from-sky-300 via-blue-400 to-indigo-400',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200',
  },
  {
    avatar: 'from-teal-500 to-cyan-600',
    cover: 'from-teal-300 via-cyan-300 to-sky-400',
    chip: 'bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200',
  },
  {
    avatar: 'from-emerald-500 to-teal-600',
    cover: 'from-emerald-300 via-teal-300 to-cyan-300',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
  },
  {
    avatar: 'from-lime-600 to-emerald-600',
    cover: 'from-lime-300 via-emerald-300 to-teal-300',
    chip: 'bg-lime-100 text-lime-900 dark:bg-lime-400/15 dark:text-lime-200',
  },
  {
    avatar: 'from-amber-500 to-orange-600',
    cover: 'from-amber-300 via-orange-300 to-rose-300',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
  },
  {
    avatar: 'from-orange-500 to-rose-600',
    cover: 'from-orange-300 via-rose-300 to-pink-300',
    chip: 'bg-orange-100 text-orange-900 dark:bg-orange-400/15 dark:text-orange-200',
  },
  {
    avatar: 'from-rose-500 to-pink-600',
    cover: 'from-rose-300 via-pink-300 to-fuchsia-300',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200',
  },
  {
    avatar: 'from-fuchsia-500 to-purple-600',
    cover: 'from-fuchsia-300 via-purple-300 to-indigo-300',
    chip: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-400/15 dark:text-fuchsia-200',
  },
  {
    avatar: 'from-violet-500 to-purple-700',
    cover: 'from-violet-300 via-purple-300 to-sky-300',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200',
  },
];

/** A small, stable string hash (djb2): the same text always gives the same number. */
function hashText(text: string): number {
  let hash = 5381;
  for (const char of text) {
    hash = (hash * 33 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}

/** Ids spread over the palette evenly (neighbours differ); text is hashed first. */
export function getIdentityColor(seed: string | number): IdentityColor {
  const index = typeof seed === 'number' ? Math.abs(seed) : hashText(seed);
  return IDENTITY_COLORS[index % IDENTITY_COLORS.length] ?? IDENTITY_COLORS[0]!;
}

/** Up to two capital letters: the first letters of the first and the last word. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .filter((word): word is string => Boolean(word))
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();
}
