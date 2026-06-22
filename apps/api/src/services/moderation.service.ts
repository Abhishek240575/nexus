import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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

  const prompt = `You are a content moderation AI for Deemona, a public civic discourse platform in India.
Your job is to analyze user-submitted posts and decide if they are safe to publish.

The platform allows:
- Political opinions and criticism of governments/policies
- Social commentary and activism
- Debate and disagreement
- Posts in any Indian language or English
- Satire and humor (clearly labeled)
- Reporting injustice or human rights violations

The platform does NOT allow:
- Profanity, swear words, or abusive language in ANY language (English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Odia, Arabic, Mandarin, Russian, Farsi, Spanish, French, German, Portuguese, Dutch)
- Seductive, sexually suggestive, or explicit sexual content of any kind
- Solicitation or sexual overtures directed at any person
- Direct incitement to violence against any person, group, religion, caste, or community
- Hate speech targeting religion, caste, gender, ethnicity, nationality, or sexual orientation
- Content that violates Indian law (IT Act, IPC sections 153A, 295A, 499, 505)
- Doxxing or sharing private personal information without consent
- Sexual content or any content involving minors in any context
- Deliberate misinformation designed to cause panic, riots, or communal violence
- Coordinated harassment, bullying, or targeted abuse of individuals
- Any slurs, insults, or derogatory terms in any language
- Spam, promotional content, or scam links disguised as opinion
- Content glorifying terrorism, extremism, or mass violence

IMPORTANT RULES:
1. Profanity and swear words in ANY language = BLOCK (not WARN)
2. Sexually suggestive or seductive content = BLOCK
3. Threats of any kind = BLOCK
4. Hate speech targeting any group = BLOCK
5. Context does not excuse profanity — "it's just an expression" is not acceptable
6. Mixed-language posts (e.g. Hinglish, code-switching) must be checked in ALL languages present

Analyze this post and respond ONLY with a JSON object in this exact format:
{
  "decision": "PASS" | "WARN" | "FLAG" | "BLOCK",
  "reason": "brief explanation if not PASS, else null",
  "categories": ["list", "of", "detected", "issues"],
  "confidence": 0.0 to 1.0,
  "suggestion": "how user could rewrite to comply, or null"
}

Decision meanings:
- PASS: Safe to publish immediately
- WARN: Publish with a content warning label (sensitive but legal, no profanity)
- FLAG: Hold for human review before publishing
- BLOCK: Reject immediately — contains profanity, threats, hate speech, or illegal content

Post to analyze:
"""
${content}
"""
${language ? `Detected language: ${language}` : ''}

Respond only with the JSON object, no other text.`;

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean) as ModerationResult;

    return result;
  } catch (err) {
    console.error('[Moderation] AI screening failed:', err);
    // Fail open — if AI fails, pass the content for human review
    return {
      decision:   'FLAG',
      reason:     'Automated screening unavailable — queued for human review',
      categories: ['system_error'],
      confidence: 0,
      suggestion: null,
    };
  }
};

// ─── Detect language of content ───────────────────────────────────────────────
export const detectLanguage = async (content: string): Promise<string> => {
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 20,
      messages:   [{
        role:    'user',
        content: `Detect the language of this text and respond with only the language name in English (e.g. "Hindi", "English", "Tamil", "Bengali", etc.):\n\n"${content.slice(0, 200)}"`,
      }],
    });
    return response.content[0].type === 'text' ? response.content[0].text.trim() : 'Unknown';
  } catch {
    return 'Unknown';
  }
};
