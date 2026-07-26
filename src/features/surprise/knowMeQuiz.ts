import { SONG_LIBRARY, resolveLibrarySong, type SongChoice } from './songs'
import type { SurpriseGift } from './useProfile'

export type KnowMeQuestion = {
  question: string
  options: string[]
  correctIndex: number
}

export type KnowMeMode = 'auto' | 'custom'

export const MAX_KNOW_ME_QUESTIONS = 3
export const MIN_KNOW_ME_OPTIONS = 2
export const MAX_KNOW_ME_OPTIONS = 6

// Bold, solid-color palette (not the app's usual soft pastels) for the
// know-me quiz's cycling background and answer buttons -- distinct on
// purpose so this mini-quiz reads as its own "gameshow" beat.
export const KNOW_ME_COLORS: { bg: string; fg: string }[] = [
  { bg: '#22c55e', fg: '#0b2e18' },
  { bg: '#f5efe0', fg: '#241f27' },
  { bg: '#ff6fa0', fg: '#3d0f22' },
  { bg: '#8b5cf6', fg: '#ffffff' },
  { bg: '#38bdf8', fg: '#062733' },
  { bg: '#ef4444', fg: '#ffffff' },
  { bg: '#fbbf24', fg: '#3d2c04' },
]

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Builds one MC question: the real value as the correct answer, plus up to
// 3 distractors drawn from `pool` (never the real value itself), shuffled.
function buildQuestion(question: string, correct: string, pool: string[]): KnowMeQuestion | null {
  if (!correct.trim()) return null
  const distractors = shuffle(pool.filter((p) => p.toLowerCase() !== correct.toLowerCase())).slice(0, 3)
  const options = shuffle([correct, ...distractors])
  return { question, options, correctIndex: options.indexOf(correct) }
}

const NICKNAME_DISTRACTORS = ['Bug', 'Champ', 'Shorty', 'Sunshine', 'Tiger', 'Boo', 'Peanut', 'Coco']
const COUNTRY_DISTRACTORS = [
  'Kenya',
  'Nigeria',
  'South Africa',
  'Ghana',
  'Uganda',
  'Tanzania',
  'Ethiopia',
  'Rwanda',
]
const GIFT_DISTRACTORS = [
  'A surprise trip',
  'Concert tickets',
  'A new phone',
  'A puppy',
  'Dinner reservations',
  'A spa day',
  'Sneakers',
  'A promise ring',
]
const LOCATION_DISTRACTORS = [
  'The beach',
  'A rooftop restaurant',
  'Her favorite café',
  'The movies',
  'A hotel getaway',
  'Home, just the two of us',
]

function songTitle(song: SongChoice | null | undefined): string {
  if (!song) return ''
  if (song.type === 'upload') return song.name.replace(/\.[^./]+$/, '')
  return resolveLibrarySong(song)?.title ?? ''
}

// Auto-builds up to MAX_KNOW_ME_QUESTIONS questions from what he already
// typed into the Details form -- no separate content-authoring step needed.
// gift.title / song / him_country are all required fields at creation time,
// so this always has at least those 3 to work with even if he skipped both
// nicknames and the gift location.
export function generateAutoQuestions(surprise: {
  her_nickname: string
  him_nickname: string
  him_country: string
  gift: Pick<SurpriseGift, 'title' | 'location'>
  song: SongChoice | null
}): KnowMeQuestion[] {
  const candidates = [
    buildQuestion('What do I call you?', surprise.her_nickname, NICKNAME_DISTRACTORS),
    buildQuestion('What should you call me?', surprise.him_nickname, NICKNAME_DISTRACTORS),
    buildQuestion(
      'What am I actually surprising you with?',
      surprise.gift.title,
      GIFT_DISTRACTORS,
    ),
    buildQuestion(
      'Which song did I pick for you?',
      songTitle(surprise.song),
      SONG_LIBRARY.map((s) => s.title),
    ),
    buildQuestion('Which country am I really from?', surprise.him_country, COUNTRY_DISTRACTORS),
    buildQuestion('Where are we going for it?', surprise.gift.location, LOCATION_DISTRACTORS),
  ]

  return candidates.filter((q): q is KnowMeQuestion => q !== null).slice(0, MAX_KNOW_ME_QUESTIONS)
}
