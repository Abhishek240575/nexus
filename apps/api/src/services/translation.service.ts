import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

export const SUPPORTED_LANGUAGES = [
  { code: 'en',    name: 'English',    native: 'English'    },
  { code: 'hi',    name: 'Hindi',      native: 'हिंदी'       },
  { code: 'ta',    name: 'Tamil',      native: 'தமிழ்'      },
  { code: 'te',    name: 'Telugu',     native: 'తెలుగు'     },
  { code: 'bn',    name: 'Bengali',    native: 'বাংলা'      },
  { code: 'mr',    name: 'Marathi',    native: 'मराठी'      },
  { code: 'gu',    name: 'Gujarati',   native: 'ગુજરાતી'    },
  { code: 'kn',    name: 'Kannada',    native: 'ಕನ್ನಡ'      },
  { code: 'ml',    name: 'Malayalam',  native: 'മലയാളം'     },
  { code: 'pa',    name: 'Punjabi',    native: 'ਪੰਜਾਬੀ'     },
  { code: 'ur',    name: 'Urdu',       native: 'اردو'       },
  { code: 'or',    name: 'Odia',       native: 'ଓଡ଼ିଆ'      },
];

// ─── Detect language ──────────────────────────────────────────────────────────
export const detectLanguage = async (text: string): Promise<{ code: string; name: string }> => {
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 50,
      messages:   [{
        role:    'user',
        content: [
          'Detect the language of this text. Respond with ONLY a JSON object like: {"code":"hi","name":"Hindi"}',
          'Supported codes: en, hi, ta, te, bn, mr, gu, kn, ml, pa, ur, or',
          'If unsure, use {"code":"en","name":"English"}',
          '',
          'Text: ' + text.slice(0, 300),
        ].join('\n'),
      }],
    });

    const raw  = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { code: 'en', name: 'English' };
  }
};

// ─── Translate text ───────────────────────────────────────────────────────────
export const translateText = async (
  text:       string,
  targetLang: string,
  sourceLang?: string
): Promise<string> => {
  const target = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
  if (!target) throw new Error('Unsupported language');

  // Don't translate if already in target language
  if (sourceLang === targetLang) return text;

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 500,
      messages:   [{
        role:    'user',
        content: [
          `Translate the following text to ${target.name} (${target.native}).`,
          'Rules:',
          '- Preserve all hashtags (#word) exactly as-is, do not translate them',
          '- Preserve all @mentions exactly as-is',
          '- Preserve all URLs exactly as-is',
          '- Keep the same tone and meaning',
          '- Return ONLY the translated text, nothing else',
          '',
          'Text to translate:',
          text,
        ].join('\n'),
      }],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : text;
  } catch {
    return text;
  }
};
