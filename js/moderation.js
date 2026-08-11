/**
 * Aetherweave Moderation & Bad Words Detection Engine
 * Strictly filters profanity and inappropriate content in English and Filipino/Tagalog.
 */

const BAD_WORDS_LIST = [
  // English Profanity & Slurs
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckhead', 'motherfucker', 'fuk', 'fck',
  'shit', 'shitty', 'shitting', 'shited', 'bullshit',
  'bitch', 'bitches', 'bitchy', 'btch',
  'asshole', 'ass', 'asses', 'asswipe', 'dumbass', 'jackass',
  'cunt', 'cunts',
  'dick', 'dicks', 'dickhead', 'cock', 'cocks', 'cocksucker',
  'pussy', 'pussies', 'vagina', 'penis', 'clitoris',
  'bastard', 'slut', 'sluts', 'whore', 'whores', 'prostitute',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'douche', 'prick', 'wanker',
  'porn', 'porno', 'pornography', 'hentai', 'sex', 'sexy', 'nude', 'nudes',

  // Tagalog / Filipino Profanity & Vulgarities
  'tangina', 'tang ina', 'tang-ina', 'putangina', 'putang ina', 'putang-ina', 'pukingina', 'puking ina',
  'pucha', 'pota', 'puta', 'pinaf', 'pukina', 'pukinangina',
  'gago', 'gaga', 'gaguhan', 'tarantado', 'tarantada', 'tarandato',
  'bobo', 'boba', 'kabobohan', 'engot', 'tanga', 'inutil', 'gunggong', 'ulol', 'ulopong',
  'puki', 'pukie', 'pepino', 'kantot', 'kantutan', 'kumantot', 'makantot',
  'tamod', 'bayag', 'titi', 'etits', 'burat', 'utong', 'bulbol', 'mabulbol',
  'kupal', 'kupals', 'hinayupak', 'hayop ka', 'hayopka', 'leche', 'letche',
  'bwisit', 'bwisit', 'lintik', 'pokpok', 'pok-pok', 'pesteng', 'peste',
  'demonyo', 'hudas', 'siraulo', 'sira-ulo', 'tarantado'
];

// Severe words checked even as substrings inside longer words
const SEVERE_SUBSTRINGS = [
  'fuck', 'shit', 'bitch', 'cunt', 'dickhead', 'motherfucker', 'nigger', 'faggot',
  'tangina', 'putangina', 'pukingina', 'kantot', 'burat', 'kupal', 'pukinangina'
];

/**
 * Normalizes text to catch obfuscated profanity like f.u.c.k, b!tch, t*ngina, b0b0
 */
function normalizeText(text) {
  if (!text) return '';
  let str = text.toLowerCase();

  // Leetspeak character mapping
  const leetMap = {
    '@': 'a', '4': 'a',
    '$': 's', '5': 's',
    '!': 'i', '1': 'i', '|': 'i',
    '0': 'o',
    '3': 'e',
    '+': 't', '7': 't',
    '8': 'b',
    'v': 'u'
  };

  let translated = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    translated += leetMap[ch] || ch;
  }

  return translated;
}

/**
 * Strips punctuation and symbols between characters (e.g. f.u.c.k -> fuck)
 */
function stripSpacedSymbols(str) {
  // Remove non-alphanumeric chars except space
  return str.replace(/[^a-z0-9\s]/g, '');
}

/**
 * Collapses repeating letters (e.g. boooooobo -> bobo, fuuuck -> fuck)
 */
function collapseRepeats(str) {
  return str.replace(/(.)\1{2,}/g, '$1');
}

/**
 * Main profanity check function
 * @param {string} input - Text to inspect
 * @returns {{ hasBadWords: boolean, foundWord?: string }}
 */
export function checkProfanity(input) {
  if (!input || typeof input !== 'string') {
    return { hasBadWords: false };
  }

  // Plain text conversion if HTML
  const tempDiv = (typeof document !== 'undefined') ? document.createElement('div') : null;
  let text = input;
  if (tempDiv) {
    tempDiv.innerHTML = input;
    text = tempDiv.textContent || tempDiv.innerText || input;
  }

  const rawLower = text.toLowerCase();
  const normalized = normalizeText(text);
  const cleanAlpha = stripSpacedSymbols(normalized);
  const collapsed = collapseRepeats(cleanAlpha);

  // 1. Direct word check against raw & normalized text
  const words = rawLower.split(/[\s,.\-!?:;"'()\[\]{}/*\\|<>_]+/);
  const normalizedWords = cleanAlpha.split(/\s+/);
  const collapsedWords = collapsed.split(/\s+/);

  const allWordsToCheck = [...new Set([...words, ...normalizedWords, ...collapsedWords])];

  for (const word of allWordsToCheck) {
    if (!word || word.length < 2) continue;
    if (BAD_WORDS_LIST.includes(word)) {
      return { hasBadWords: true, foundWord: word };
    }
  }

  // 2. Check severe substrings in stripped contiguous text (e.g. "f.u.c.k" -> "fuck")
  const contiguousAlpha = cleanAlpha.replace(/\s+/g, '');
  const contiguousCollapsed = collapsed.replace(/\s+/g, '');

  for (const severe of SEVERE_SUBSTRINGS) {
    if (contiguousAlpha.includes(severe) || contiguousCollapsed.includes(severe) || rawLower.includes(severe)) {
      return { hasBadWords: true, foundWord: severe };
    }
  }

  // 3. Regex pattern checks for multi-word or spaced Tagalog/English profanity
  const patternRegexes = [
    /p\s*u\s*t\s*a\s*n\s*g\s*i\s*n\s*a/i,
    /t\s*a\s*n\s*g\s*i\s*n\s*a/i,
    /f\s*u\s*c\s*k/i,
    /s\s*h\s*i\s*t/i,
    /b\s*i\s*t\s*c\s*h/i,
    /b\s*o\s*b\s*o/i,
    /g\s*a\s*g\s*o/i,
    /t\s*a\s*r\s*a\s*n\s*t\s*a\s*d\s*o/i,
    /k\s*a\s*n\s*t\s*o\s*t/i
  ];

  for (const reg of patternRegexes) {
    if (reg.test(rawLower) || reg.test(normalized)) {
      return { hasBadWords: true, foundWord: 'profanity' };
    }
  }

  return { hasBadWords: false };
}
