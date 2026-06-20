import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

// ─── All supported languages (Indian + Global) ────────────────────────────────
export const SUPPORTED_LANGUAGES = [
  // Indian languages
  { code: 'en',  name: 'English',    native: 'English',      group: 'global'  },
  { code: 'hi',  name: 'Hindi',      native: 'हिंदी',          group: 'indian'  },
  { code: 'ta',  name: 'Tamil',      native: 'தமிழ்',         group: 'indian'  },
  { code: 'te',  name: 'Telugu',     native: 'తెలుగు',        group: 'indian'  },
  { code: 'bn',  name: 'Bengali',    native: 'বাংলা',         group: 'indian'  },
  { code: 'mr',  name: 'Marathi',    native: 'मराठी',         group: 'indian'  },
  { code: 'gu',  name: 'Gujarati',   native: 'ગુજરાતી',       group: 'indian'  },
  { code: 'kn',  name: 'Kannada',    native: 'ಕನ್ನಡ',         group: 'indian'  },
  { code: 'ml',  name: 'Malayalam',  native: 'മലയാളം',        group: 'indian'  },
  { code: 'pa',  name: 'Punjabi',    native: 'ਪੰਜਾਬੀ',        group: 'indian'  },
  { code: 'ur',  name: 'Urdu',       native: 'اردو',          group: 'indian'  },
  { code: 'or',  name: 'Odia',       native: 'ଓଡ଼ିଆ',         group: 'indian'  },
  // Global languages
  { code: 'ar',  name: 'Arabic',     native: 'العربية',       group: 'global'  },
  { code: 'zh',  name: 'Mandarin',   native: '中文',           group: 'global'  },
  { code: 'ru',  name: 'Russian',    native: 'Русский',       group: 'global'  },
  { code: 'fa',  name: 'Farsi',      native: 'فارسی',         group: 'global'  },
  { code: 'es',  name: 'Spanish',    native: 'Español',       group: 'global'  },
  { code: 'fr',  name: 'French',     native: 'Français',      group: 'global'  },
  { code: 'de',  name: 'German',     native: 'Deutsch',       group: 'global'  },
  { code: 'pt',  name: 'Portuguese', native: 'Português',     group: 'global'  },
  { code: 'nl',  name: 'Dutch',      native: 'Nederlands',    group: 'global'  },
];

const LANG_CODES = SUPPORTED_LANGUAGES.map(l => l.code).join(', ');

// ─── Detect language of a text ────────────────────────────────────────────────
export const detectLanguage = async (text: string): Promise<{ code: string; name: string }> => {
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 50,
      messages:   [{
        role:    'user',
        content: [
          'Detect the language of this text. Respond with ONLY a JSON object like: {"code":"hi","name":"Hindi"}',
          `Supported codes: ${LANG_CODES}`,
          'If unsure or not in supported list, use {"code":"en","name":"English"}',
          '',
          'Text: ' + text.slice(0, 300),
        ].join('\n'),
      }],
    });
    const raw   = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { code: 'en', name: 'English' };
  }
};

// ─── Translate text to target language ───────────────────────────────────────
export const translateText = async (
  text:       string,
  targetLang: string,
  sourceLang?: string,
  context?:   'political' | 'civic' | 'general'
): Promise<string> => {
  const target = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
  if (!target) throw new Error(`Unsupported target language: ${targetLang}`);

  if (sourceLang === targetLang) return text;

  // RTL languages — flag for frontend awareness (no change to translation logic)
  const isRTL = ['ar', 'ur', 'fa', 'he'].includes(targetLang);

  const contextNote = context === 'political' || context === 'civic'
    ? '- This is political/civic content — preserve ideological nuance, sarcasm, and protest language exactly'
    : '';

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{
        role:    'user',
        content: [
          `Translate the following text to ${target.name} (${target.native}).`,
          'Rules:',
          '- Preserve all hashtags (#word) exactly as-is, do not translate them',
          '- Preserve all @mentions exactly as-is',
          '- Preserve all URLs exactly as-is',
          '- Keep the same tone, register, and emotional weight',
          '- Preserve culturally-specific terms that have no equivalent (transliterate if needed)',
          contextNote,
          '- Return ONLY the translated text, nothing else, no explanation',
          '',
          'Text to translate:',
          text,
        ].filter(Boolean).join('\n'),
      }],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : text;
  } catch {
    return text;
  }
};

// ─── Auto-detect and translate (used when source language is unknown) ─────────
export const autoTranslate = async (
  text:       string,
  targetLang: string
): Promise<{ translated: string; detected_lang: string; detected_lang_name: string }> => {
  const detected = await detectLanguage(text);
  const translated = await translateText(text, targetLang, detected.code);
  return {
    translated,
    detected_lang:      detected.code,
    detected_lang_name: detected.name,
  };
};
