// Fast pre-filter for explicit profanity — runs before AI moderation
// Catches obvious cases instantly with zero latency

// Core English profanity
const BLOCK_WORDS_EN = [
  'fuck', 'fucker', 'fucking', 'fucked', 'fucks', 'motherfucker', 'motherfucking',
  'shit', 'shitting', 'bullshit',
  'cunt', 'cunts',
  'cock', 'cocks', 'cocksucker',
  'pussy', 'pussies',
  'asshole', 'arsehole', 'assholes',
  'bitch', 'bitches',
  'bastard', 'bastards',
  'whore', 'whores',
  'slut', 'sluts',
  'nigger', 'niggers', 'nigga',
  'faggot', 'faggots',
  'retard', 'retards',
  'rape', 'raped', 'raping', 'rapist',
  'kill yourself', 'kys', 'go die', 'kill urself',
];

// Hindi/Hinglish profanity (romanised)
const BLOCK_WORDS_HI = [
  'madarchod', 'mc', 'bhenchod', 'bc', 'chutiya', 'chutiye', 'chutiyapa',
  'bhosdike', 'bhosdika', 'bhosdiwale',
  'gandu', 'gaand', 'gaand mara',
  'lund', 'lode', 'teri maa', 'teri behen',
  'randi', 'randwa', 'harami', 'haramzada', 'haramzadi',
  'saala', 'sali', 'kamina', 'kaminey',
  'bsdk', 'mmc', 'lmao kys',
];

// Threat keywords — always BLOCK regardless of context
const THREAT_PHRASES = [
  'i will kill', 'i will rape', 'i will hurt',
  'going to kill', 'going to rape', 'going to hurt',
  'want to kill', 'want to rape',
  'should be killed', 'should be raped', 'should die',
  'death to', 'bomb', 'shoot him', 'shoot her', 'shoot them',
  'blow up', 'burn down',
];

const ALL_BLOCKED = [...BLOCK_WORDS_EN, ...BLOCK_WORDS_HI];

export interface PreFilterResult {
  blocked:  boolean;
  reason:   string | null;
  matched:  string | null;
  severity: 'profanity' | 'threat' | null;
}

export const preFilterContent = (text: string): PreFilterResult => {
  if (!text || text.trim().length === 0) {
    return { blocked: false, reason: null, matched: null, severity: null };
  }

  const lower = text.toLowerCase().trim();

  // Check threat phrases first (highest severity)
  for (const phrase of THREAT_PHRASES) {
    if (lower.includes(phrase)) {
      return {
        blocked:  true,
        reason:   'Post contains threatening language which violates Deemona community guidelines.',
        matched:  phrase,
        severity: 'threat',
      };
    }
  }

  // Check profanity — word boundary match to avoid false positives
  // e.g. "classic" should not match "ass"
  for (const word of ALL_BLOCKED) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // For multi-word phrases, use simple includes; for single words use word boundary
    const pattern = word.includes(' ')
      ? new RegExp(escaped, 'i')
      : new RegExp(`\\b${escaped}\\b`, 'i');

    if (pattern.test(lower)) {
      return {
        blocked:  true,
        reason:   'Post contains language that violates Deemona community guidelines. Please keep the conversation respectful.',
        matched:  word,
        severity: 'profanity',
      };
    }
  }

  return { blocked: false, reason: null, matched: null, severity: null };
};
