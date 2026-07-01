import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });

export type AssistAction =
  | 'improve'
  | 'shorten'
  | 'expand'
  | 'hashtags'
  | 'grammar'
  | 'formal'
  | 'casual'
  | 'translate_en';

const ACTION_PROMPTS: Record<AssistAction, string> = {
  improve:      'Improve this post to make it more engaging, clear, and impactful. Keep the same language and core message.',
  shorten:      'Make this post shorter and more punchy. Keep the key message. Stay under 140 characters if possible.',
  expand:       'Expand this post with more detail, context, or supporting points. Keep it engaging and under 500 characters.',
  hashtags:     'Add 3-5 relevant hashtags to this post. Place them at the end. Return the full post with hashtags added.',
  grammar:      'Fix grammar, spelling, and punctuation in this post. Do not change the meaning or language.',
  formal:       'Rewrite this post in a more formal, professional tone. Keep the same language.',
  casual:       'Rewrite this post in a more casual, conversational tone. Keep the same language.',
  translate_en: 'Translate this post to English. Keep hashtags and @mentions unchanged.',
};

export const assistWriting = async (
  text:    string,
  action:  AssistAction,
  lang?:   string
): Promise<string> => {
  const prompt = ACTION_PROMPTS[action];
  if (!prompt) throw new Error(`Unknown action: ${action}`);

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 500,
    messages:   [{
      role:    'user',
      content: `${prompt}

IMPORTANT RULES:
- Return ONLY the rewritten post text, nothing else
- No explanations, no preamble, no quotes around the text
- Preserve all @mentions exactly
- Preserve all URLs exactly
- This is for Deemona, an Indian civic discourse platform
${lang ? `- Original language: ${lang}` : ''}

Post to process:
${text}`,
    }],
  });

  return response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : text;
};
