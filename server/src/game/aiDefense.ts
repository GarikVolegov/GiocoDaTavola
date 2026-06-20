// Fase C: AI-generated bot defenses via a SELF-HOSTED / OpenAI-compatible LLM
// (e.g. Ollama running Gemma locally). This sits ON TOP of the templated seam
// from Fase B (botDefense.ts): if no endpoint is configured, or the call
// fails/times out, callers fall back to the template, so the game never breaks.
//
// Configure with env vars (e.g. server/.env):
//   AI_BASE_URL  OpenAI-compatible base, e.g. http://localhost:11434/v1 (Ollama)
//   AI_MODEL     model name, e.g. gemma3:12b (local) or gemma3:4b (smaller host)
//   AI_API_KEY   optional bearer token (Ollama ignores it; hosted gateways need it)
//
// Only non-sensitive data (the dilemma + persona) is sent to the model — never
// any human player's data.
import type { Dilemma } from './deck';
import type { BotPersona, VoteChoice } from './rooms';

// A short tone hint per behaviour persona, to flavour the generated argument.
const PERSONA_VOICE: Record<BotPersona, string> = {
  roccione: 'deciso e irremovibile',
  indeciso: 'titubante ma sincero',
  gregge: 'che cerca il consenso del gruppo',
  bastian: 'provocatorio e controcorrente',
  equilibrato: 'pacato e ponderato',
};

/** Turns a system+user prompt into text (or null on failure). Injectable for tests. */
export type Completer = (req: { system: string; user: string }) => Promise<string | null>;

/** Whether AI-generated defenses are enabled (a self-hosted endpoint is configured). */
export function aiDefenseEnabled(): boolean {
  return Boolean(process.env.AI_BASE_URL);
}

// Default completer: POST to an OpenAI-compatible /chat/completions endpoint.
// Returns null when no endpoint is configured or on any error/timeout/non-200.
const defaultComplete: Completer = async ({ system, user }) => {
  const base = process.env.AI_BASE_URL;
  if (!base) return null;
  const model = process.env.AI_MODEL || 'gemma3:4b';
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.AI_API_KEY ? { authorization: `Bearer ${process.env.AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 160,
        temperature: 0.8,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    return text ? text : null;
  } catch {
    return null;
  }
};

/**
 * Generate a 1-2 sentence defense for a bot defending `side` of `dilemma`, in the
 * persona's voice. Returns null when AI is disabled or the call fails — callers
 * keep the templated fallback. `deps.complete` is injectable for tests.
 */
export async function generateBotDefense(
  persona: BotPersona,
  dilemma: Dilemma,
  side: VoteChoice,
  deps: { complete?: Completer } = {},
): Promise<string | null> {
  const complete = deps.complete ?? defaultComplete;
  const option = side === 'A' ? dilemma.optionA : dilemma.optionB;
  try {
    const text = await complete({
      system:
        `Sei un personaggio in un party game di dibattiti tra amici, con un tono ${PERSONA_VOICE[persona]}. ` +
        'Difendi la TUA scelta in 1-2 frasi brevi, in italiano, per convincere gli altri a passare dalla tua parte. ' +
        'Vai dritto al punto: niente preamboli e niente virgolette attorno alla frase.',
      user: `Dilemma: "${dilemma.text}"\nLa tua scelta: "${option}".`,
    });
    const trimmed = text?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
