/**
 * Turns Devanagari (Hindi, Marathi) names into plain English letters for
 * Student IDs: रवि → ravi, अरुणेश धर → arunesh dhar, प्रिया → priya.
 * Only the ID uses this; the name is still stored and shown as typed.
 *
 * Kept simple and predictable on purpose: long vowels become short ones
 * (राम → ram, सीता → sita), the silent final "a" of a word is dropped
 * (धर → dhar) unless the word ends in a consonant cluster (कृष्ण → krishna)
 * or is a single letter. Other characters pass through unchanged.
 *
 * Combining and invisible characters are written as \u escapes so they
 * stay visible and can't be changed by an editor.
 */

const VIRAMA = '\u094D'; // ्  (joins consonants: क्ष)
const NUKTA = '\u093C'; // ़  (dot below: ज़)
const ZERO_WIDTH = new Set(['\u200C', '\u200D']); // (non-)joiner

const CONSONANTS: Record<string, string> = {
  क: 'k',
  ख: 'kh',
  ग: 'g',
  घ: 'gh',
  ङ: 'n',
  च: 'ch',
  छ: 'chh',
  ज: 'j',
  झ: 'jh',
  ञ: 'n',
  ट: 't',
  ठ: 'th',
  ड: 'd',
  ढ: 'dh',
  ण: 'n',
  त: 't',
  थ: 'th',
  द: 'd',
  ध: 'dh',
  न: 'n',
  प: 'p',
  फ: 'ph',
  ब: 'b',
  भ: 'bh',
  म: 'm',
  य: 'y',
  र: 'r',
  ल: 'l',
  ळ: 'l',
  व: 'v',
  श: 'sh',
  ष: 'sh',
  स: 's',
  ह: 'h',
  // Precomposed letters with a dot below
  '\u0929': 'n', // ऩ
  '\u0931': 'r', // ऱ
  '\u0934': 'l', // ऴ
  '\u0958': 'q', // क़
  '\u0959': 'kh', // ख़
  '\u095A': 'g', // ग़
  '\u095B': 'z', // ज़
  '\u095C': 'r', // ड़
  '\u095D': 'rh', // ढ़
  '\u095E': 'f', // फ़
  '\u095F': 'y', // य़
};

// The same letters typed as consonant + NUKTA (two characters)
const NUKTA_CONSONANTS: Record<string, string> = {
  क: 'q',
  ख: 'kh',
  ग: 'g',
  ज: 'z',
  ड: 'r',
  ढ: 'rh',
  फ: 'f',
  य: 'y',
};

const INDEPENDENT_VOWELS: Record<string, string> = {
  अ: 'a',
  आ: 'a',
  इ: 'i',
  ई: 'i',
  उ: 'u',
  ऊ: 'u',
  ऋ: 'ri',
  ॠ: 'ri',
  ऌ: 'li',
  ए: 'e',
  ऐ: 'ai',
  ओ: 'o',
  औ: 'au',
  ऑ: 'o',
  ऍ: 'e',
  ऎ: 'e',
  ऒ: 'o',
};

// Vowel signs (matras) written after a consonant
const VOWEL_SIGNS: Record<string, string> = {
  '\u093E': 'a', // ा
  '\u093F': 'i', // ि
  '\u0940': 'i', // ी
  '\u0941': 'u', // ु
  '\u0942': 'u', // ू
  '\u0943': 'ri', // ृ
  '\u0944': 'ri', // ॄ
  '\u0962': 'li', // ॢ
  '\u0945': 'e', // ॅ
  '\u0946': 'e', // ॆ
  '\u0947': 'e', // े
  '\u0948': 'ai', // ै
  '\u0949': 'o', // ॉ
  '\u094A': 'o', // ॊ
  '\u094B': 'o', // ो
  '\u094C': 'au', // ौ
};

const MARKS: Record<string, string> = {
  '\u0902': 'n', // ं anusvara
  '\u0901': 'n', // ँ chandrabindu
  '\u0903': 'h', // ः visarga
  '\u093D': '', // ऽ avagraha
};

const isDevanagari = (ch: string) => ch >= '\u0900' && ch <= '\u097F';

export function transliterateDevanagari(text: string): string {
  if (!/[\u0900-\u097F]/.test(text)) return text;

  let out = '';
  let wordStart = 0; // index in `out` where the current word began
  // The last consonant whose vowel isn't decided yet.
  let pending: { roman: string; inCluster: boolean } | null = null;
  let afterVirama = false;

  const flushWithA = () => {
    if (pending) out += `${pending.roman}a`;
    pending = null;
  };
  const endWord = () => {
    if (pending) {
      // Hindi drops a word's final "a" (धर → dhar), except after a
      // consonant cluster (कृष्ण → krishna) or in a one-letter word.
      const keepA = pending.inCluster || out.length === wordStart;
      out += keepA ? `${pending.roman}a` : pending.roman;
    }
    pending = null;
    afterVirama = false;
  };

  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (ZERO_WIDTH.has(ch)) continue; // only changes how letters are drawn

    // ज्ञ is said "gy" (ज्ञान → gyan), not "jn".
    if (ch === 'ज' && chars[i + 1] === VIRAMA && chars[i + 2] === 'ञ') {
      flushWithA();
      pending = { roman: 'gy', inCluster: afterVirama };
      afterVirama = false;
      i += 2;
      continue;
    }

    if (CONSONANTS[ch] !== undefined) {
      flushWithA();
      let roman = CONSONANTS[ch];
      if (chars[i + 1] === NUKTA && NUKTA_CONSONANTS[ch] !== undefined) {
        roman = NUKTA_CONSONANTS[ch];
        i += 1;
      }
      pending = { roman, inCluster: afterVirama };
      afterVirama = false;
    } else if (VOWEL_SIGNS[ch] !== undefined) {
      out += (pending ? pending.roman : '') + VOWEL_SIGNS[ch];
      pending = null;
      afterVirama = false;
    } else if (ch === VIRAMA) {
      if (pending) out += pending.roman;
      pending = null;
      afterVirama = true;
    } else if (MARKS[ch] !== undefined) {
      flushWithA();
      out += MARKS[ch];
      afterVirama = false;
    } else if (INDEPENDENT_VOWELS[ch] !== undefined) {
      flushWithA();
      out += INDEPENDENT_VOWELS[ch];
      afterVirama = false;
    } else if (isDevanagari(ch)) {
      // Digits, danda, a stray nukta, etc.: no letters for the ID.
      afterVirama = false;
    } else {
      // Space, Latin letter or symbol: the Devanagari word (if any) ends.
      endWord();
      out += ch;
      wordStart = out.length;
    }
  }
  endWord();
  return out;
}
