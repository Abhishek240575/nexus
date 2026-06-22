// Multilingual profanity pre-filter — covers all 21 platform languages
// Layer 1: Fast word-list check (zero latency)
// Layer 2: AI moderation handles nuanced cases and non-romanised scripts

// ─── English ──────────────────────────────────────────────────────────────────
const EN = [
  'fuck', 'fucker', 'fucking', 'fucked', 'fucks', 'motherfucker', 'motherfucking',
  'shit', 'shitting', 'bullshit', 'cunt', 'cunts', 'cock', 'cocks', 'cocksucker',
  'pussy', 'pussies', 'asshole', 'arsehole', 'assholes', 'bitch', 'bitches',
  'bastard', 'bastards', 'whore', 'whores', 'slut', 'sluts',
  'nigger', 'niggers', 'nigga', 'faggot', 'faggots', 'retard', 'retards',
  'rape', 'raped', 'raping', 'rapist', 'pedophile', 'pedo',
  'kill yourself', 'kys', 'go die', 'kill urself', 'end yourself',
  'die bitch', 'die slut', 'i will kill', 'i will rape', 'i will hurt',
  'death to', 'blow up', 'shoot him', 'shoot her', 'bomb',
];

// ─── Hindi / Hinglish (romanised) ────────────────────────────────────────────
const HI = [
  'madarchod', 'mc', 'bhenchod', 'bc', 'chutiya', 'chutiye', 'chutiyapa',
  'bhosdike', 'bhosdika', 'bhosdiwale', 'bhosdiwali',
  'gandu', 'gaand', 'gaand mara', 'lund', 'lode',
  'teri maa ki', 'teri maa', 'teri behen', 'teri bhen',
  'randi', 'randwa', 'harami', 'haramzada', 'haramzadi',
  'saala', 'sali', 'kamina', 'kaminey', 'bsdk', 'mmc',
  'jaan se marunga', 'maar dunga', 'kaat dunga',
];

// ─── Tamil (romanised) ────────────────────────────────────────────────────────
const TA = [
  'otha', 'oothu', 'sunni', 'pundai', 'punda', 'thevidiya', 'thevdiya',
  'naaye', 'naye', 'koothi', 'layam', 'ennoda', 'soothu',
  'rape pannuven', 'thookku poduven', 'koluththuven',
];

// ─── Telugu (romanised) ───────────────────────────────────────────────────────
const TE = [
  'dengu', 'dengey', 'pooku', 'gudda', 'lanja', 'lanjakodaka',
  'modda', 'dodda', 'bitch kodaka', 'randi', 'vennela',
  'chankera', 'munda', 'sala', 'nayana',
];

// ─── Bengali (romanised) ──────────────────────────────────────────────────────
const BN = [
  'bokachoda', 'boka choda', 'choda', 'chudi', 'khankir chele', 'khanki',
  'magi', 'beshya', 'shala', 'haramjada', 'gadha', 'kuttar baccha',
  'tor maa ke', 'tor bon ke',
];

// ─── Marathi (romanised) ─────────────────────────────────────────────────────
const MR = [
  'zavadya', 'jhavadya', 'lavda', 'lavde', 'bhosadya', 'bhosadike',
  'randi', 'madar', 'madarchod', 'haramkhor', 'saala', 'aai zhavli',
  'bhen zhavli', 'tujhya aaicha', 'maryad',
];

// ─── Gujarati (romanised) ─────────────────────────────────────────────────────
const GU = [
  'bhand', 'bhosdo', 'bhosdivala', 'lavda', 'lavdo',
  'randi', 'madar', 'chinal', 'harami', 'sala', 'sali',
  'tari ma ni', 'tari ben ni',
];

// ─── Kannada (romanised) ─────────────────────────────────────────────────────
const KN = [
  'tika', 'tikka', 'sule', 'sulemaganey', 'haavina magne',
  'ooru bidodu', 'thikla', 'nin amma', 'nin akka',
  'haadu', 'gudda', 'bosudi', 'hode',
];

// ─── Malayalam (romanised) ────────────────────────────────────────────────────
const ML = [
  'poorr', 'poo', 'kunna', 'myre', 'myru', 'thayoli', 'thayale',
  'andi', 'kundi', 'patthi', 'veshtam',
  'kollum', 'cherkkam', 'rape cheyyum',
];

// ─── Punjabi (romanised) ─────────────────────────────────────────────────────
const PA = [
  'bhen di', 'bhen da', 'teri maa', 'teri pen', 'lund', 'lode',
  'phuddi', 'phud', 'gadha', 'kutta', 'kutti', 'randi', 'harami',
  'madar', 'teri penn', 'tenu mar dunga',
];

// ─── Urdu (romanised) ────────────────────────────────────────────────────────
const UR = [
  'madarchod', 'behenchod', 'chutiya', 'harami', 'bhosdike',
  'randi', 'sala', 'gandu', 'lund', 'bhosdi',
  'maar dunga', 'khatam kar dunga', 'jaan se mar dunga',
];

// ─── Odia (romanised) ────────────────────────────────────────────────────────
const OR = [
  'bhoda', 'bhodia', 'phoda', 'nali', 'gandu', 'loda',
  'randi', 'madar', 'sala', 'harami', 'kuttar pua',
  'mar deba', 'kaati deba',
];

// ─── Arabic (romanised) ──────────────────────────────────────────────────────
const AR = [
  'kuss', 'kus', 'kos', 'sharmouta', 'sharmuta', 'ibn el sharmouta',
  'kalb', 'hayawan', 'ibn el kalb', 'zibb', 'ayr', 'teez',
  'ya ibn el', 'yel an',
];

// ─── Russian (romanised) ─────────────────────────────────────────────────────
const RU = [
  'blyad', 'blya', 'ebat', 'yebat', 'pizda', 'pizdets', 'khuy', 'khui',
  'suka', 'mudak', 'dolboeb', 'ublydok', 'gandon', 'zalupa',
  'ubeyu', 'prikolyu',
];

// ─── Farsi (romanised) ───────────────────────────────────────────────────────
const FA = [
  'kos', 'kir', 'kusse', 'mader jende', 'jende', 'khak bar saret',
  'koskesh', 'gaei', 'mikonam', 'bikir', 'harome', 'najaib',
];

// ─── Spanish (romanised) ─────────────────────────────────────────────────────
const ES = [
  'puta', 'puto', 'mierda', 'coño', 'cono', 'joder', 'follar',
  'hijo de puta', 'hdp', 'pendejo', 'cabron', 'chingar', 'pinche',
  'te voy a matar', 'te voy a violar',
];

// ─── French (romanised) ──────────────────────────────────────────────────────
const FR = [
  'putain', 'merde', 'connard', 'salope', 'enculer', 'va te faire',
  'fils de pute', 'fdp', 'baiseur', 'nique ta', 'ntm',
  'je vais te tuer', 'je vais te violer',
];

// ─── German (romanised) ──────────────────────────────────────────────────────
const DE = [
  'scheiße', 'scheiße', 'scheisse', 'hurensohn', 'fotze', 'wichser',
  'arschloch', 'fick dich', 'verpiss dich', 'ich bringe dich um',
  'nazi', 'heil hitler',
];

// ─── Portuguese (romanised) ──────────────────────────────────────────────────
const PT = [
  'puta', 'caralho', 'merda', 'filho da puta', 'fdp', 'buceta',
  'pau', 'cuzao', 'viado', 'vou te matar', 'vou te estuprar',
];

// ─── Dutch (romanised) ────────────────────────────────────────────────────────
const NL = [
  'kut', 'lul', 'klootzak', 'godverdomme', 'hoer', 'kanker',
  'tering', 'tyfus', 'flikker', 'ik vermoord je', 'vuile',
];

// ─── Mandarin (romanised / pinyin) ───────────────────────────────────────────
const ZH = [
  'cao ni ma', 'caonima', 'ta ma de', 'tamade', 'sha bi', 'shabi',
  'hun dan', 'hundan', 'wang ba dan', 'wangbadan', 'cao', 'biaozi',
  'wo yao sha ni', 'wo yao qiangjian',
];

// ─── Threat phrases (universal) ──────────────────────────────────────────────
const THREATS = [
  'i will kill', 'i will rape', 'i will murder', 'going to kill',
  'going to rape', 'should be killed', 'should be raped', 'should die',
  'death to', 'blow up', 'burn down', 'shoot him', 'shoot her',
  'murder you', 'slaughter you', 'behead', 'acid attack',
];

const ALL_PROFANITY = [
  ...EN, ...HI, ...TA, ...TE, ...BN, ...MR, ...GU, ...KN,
  ...ML, ...PA, ...UR, ...OR, ...AR, ...RU, ...FA, ...ES,
  ...FR, ...DE, ...PT, ...NL, ...ZH,
];

export interface PreFilterResult {
  blocked:  boolean;
  reason:   string | null;
  matched:  string | null;
  severity: 'profanity' | 'threat' | null;
}

export const preFilterContent = (text: string): PreFilterResult => {
  if (!text?.trim()) return { blocked: false, reason: null, matched: null, severity: null };

  const lower = text.toLowerCase().trim();

  // Threats first (highest severity)
  for (const phrase of THREATS) {
    if (lower.includes(phrase)) {
      return {
        blocked:  true,
        reason:   'Post contains threatening language which violates Deemona community guidelines.',
        matched:  phrase,
        severity: 'threat',
      };
    }
  }

  // Profanity — word boundary for single words, includes for phrases
  for (const word of ALL_PROFANITY) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
