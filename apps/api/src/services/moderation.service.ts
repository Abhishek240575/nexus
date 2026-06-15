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

  const prompt = `You are a content moderation AI for Nexus, a public discourse platform in India. 
Your job is to analyze user-submitted posts and decide if they are safe to publish.

The platform allows:
- Political opinions and criticism of governments/policies
- Social commentary and activism
- Debate and disagreement
- Posts in any Indian language or English
- Satire and humor (clearly labeled)
- Reporting injustice or human rights violations

The platform does NOT allow:
- Direct incitement to violence against any person, group, religion, caste, or community
- Hate speech targeting religion, caste, gender, ethnicity, or sexual orientation
- Content that violates Indian law (IT Act, IPC sections 153A, 295A, 499, 505)
- Doxxing or sharing private personal information
- Sexual content or content exploiting minors
- Deliberate misinformation designed to cause panic or riots
- Coordinated harassment of individuals
- Spam or promotional content disguised as opinion

Analyze this post and respond ONLY with a JSON object in this exact format:
{
  "decision": "PASS" | "WARN" | "FLAG" | "BLOCK",
  "reason": "brief explanation if not PASS, else null",
  "categories": ["list", "of", "detected", "issues"],
  "confidence": 0.0 to 1.0,
  "suggestion": "how user could rewrite to comply, or null"
}

Decision meanings:
- PASS: Safe to publish immediately. Use this for ALL political opinions, criticism, social commentary, activism, debate, satire, and general discussion even if controversial
- WARN: Publish with a content warning label. Use ONLY for graphic descriptions of violence or very explicit content that is still legal
- FLAG: Hold for human review. Use ONLY when you are highly confident (>90%) of serious violations like direct incitement to violence or illegal content
- BLOCK: Reject immediately. Use ONLY for clear hate speech with slurs, direct threats against specific people, or child exploitation content

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
