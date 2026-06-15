$content = @'
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

  const prompt = `You are a content moderator for Nexus, an Indian public discourse platform.

Your job: decide if this post should be BLOCKED or allowed to stay.

BLOCK only if the post contains:
1. Explicit slurs or derogatory terms targeting religion, caste, gender, ethnicity
2. Direct threats like "I will kill/harm [person/group]"
3. Content sexualizing minors
4. Doxxing (sharing private addresses, phone numbers of real people)

DO NOT BLOCK for:
- Political opinions, even strong ones
- Social commentary
- Criticism of religions, ideologies, or political parties
- Calls for protests or demonstrations
- Satire or humor about politicians or policies
- ANY content that does not contain explicit slurs or direct threats

Post to analyze:
"""
${content}
"""

Respond ONLY with this JSON, no other text:
{
  "decision": "PASS",
  "reason": null,
  "categories": [],
  "confidence": 0.9,
  "suggestion": null
}

Replace "PASS" with "BLOCK" only if absolutely certain. Default to PASS.`;

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 200,
      messages:   [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
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
        content: `Detect the language of this text and respond with only the language name in English (e.g. "Hindi", "English", "Tamil"). Text: "${content.slice(0, 200)}"`,
      }],
    });
    return response.content[0].type === 'text' ? response.content[0].text.trim() : 'Unknown';
  } catch {
    return 'Unknown';
  }
};
'@

[System.IO.File]::WriteAllText(
  "C:\Users\Abhishek\nexus-scaffold\nexus\apps\api\src\services\moderation.service.ts",
  $content,
  (New-Object System.Text.UTF8Encoding $false)
)
Write-Host "Done"