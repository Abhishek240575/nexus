import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

export interface ModerationResult {
  decision:    'PASS' | 'WARN' | 'FLAG' | 'BLOCK';
  reason:      string | null;
  categories:  string[];
  confidence:  number;
  suggestion:  string | null;
}

export const moderateContent = async (
  content:  string,
  language?: string
): Promise<ModerationResult> => {

  const prompt = [
    'You are a content moderator for Nexus, an Indian public discourse platform.',
    '',
    'BLOCK only if the post contains:',
    '1. Explicit slurs targeting religion, caste, gender, ethnicity',
    '2. Direct threats: "I will kill/harm [specific person or group]"',
    '3. Content sexualizing minors',
    '4. Doxxing: sharing private addresses or phone numbers of real people',
    '',
    'DO NOT BLOCK for political opinions, social commentary, criticism of governments or parties, protests, satire, or any content without explicit slurs or direct threats.',
    '',
    'Post to analyze:',
    '"""',
    content,
    '"""',
    '',
    'Respond ONLY with valid JSON, no other text:',
    '{"decision":"PASS","reason":null,"categories":[],"confidence":0.9,"suggestion":null}',
    '',
    'Change decision to BLOCK only if absolutely certain. Default is PASS.',
  ].join('\n');

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 200,
      messages:   [{ role: 'user', content: prompt }],
    });

    const text  = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean) as ModerationResult;
    return result;
  } catch (err) {
    console.error('[Moderation] AI screening failed:', err);
    return {
      decision:   'PASS',
      reason:     null,
      categories: [],
      confidence: 0,
      suggestion: null,
    };
  }
};

export const detectLanguage = async (content: string): Promise<string> => {
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 20,
      messages:   [{
        role:    'user',
        content: 'Detect the language of this text and respond with only the language name in English (e.g. "Hindi", "English", "Tamil"). Text: "' + content.slice(0, 200) + '"',
      }],
    });
    return response.content[0].type === 'text' ? response.content[0].text.trim() : 'Unknown';
  } catch {
    return 'Unknown';
  }
};
