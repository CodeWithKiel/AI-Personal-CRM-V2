import OpenAI from "openai";

let client;
let clientKey;

export function getAIConfig() {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const legacyKey = process.env.XAI_API_KEY?.trim();
  const effectiveGroqKey = groqKey || (legacyKey?.startsWith("gsk_") ? legacyKey : null);
  if (effectiveGroqKey && !effectiveGroqKey.includes("PASTE_YOUR")) {
    const requestedModel = process.env.GROQ_MODEL?.trim() || process.env.XAI_MODEL?.trim() || "openai/gpt-oss-20b";
    return {
      provider: "groq",
      apiKey: effectiveGroqKey,
      baseURL: "https://api.groq.com/openai/v1",
      model: requestedModel === "gpt-oss-20b" ? "openai/gpt-oss-20b" : requestedModel
    };
  }

  const xaiKey = process.env.XAI_API_KEY?.trim();
  if (xaiKey && !xaiKey.includes("PASTE_YOUR")) {
    return {
      provider: "xai",
      apiKey: xaiKey,
      baseURL: "https://api.x.ai/v1",
      model: process.env.XAI_MODEL?.trim() || "grok-3-mini"
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey && !openaiKey.includes("PASTE_YOUR")) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseURL: undefined,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini"
    };
  }

  return { provider: "local", apiKey: null, baseURL: undefined, model: null };
}

function getClient(config) {
  if (!config.apiKey) return null;
  const nextKey = `${config.provider}:${config.apiKey}`;
  if (!client || clientKey !== nextKey) {
    client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: 30000 });
    clientKey = nextKey;
  }
  return client;
}

async function askAI(instructions, input) {
  const config = getAIConfig();
  const ai = getClient(config);
  if (!ai) return null;
  try {
    const response = await ai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input }
      ],
      temperature: 0.3
    });
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error(`${config.provider} request failed; using local fallback:`, error.message);
    return null;
  }
}

export async function summarizeNote(content) {
  const result = await askAI(
    "Summarize CRM meeting notes in 2 concise sentences. Include commitments and next steps. Return plain text.",
    content
  );
  if (result) return result;

  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  return sentences.slice(0, 2).join(" ").trim();
}

export async function generateFollowUp(contact, notes = []) {
  const context = JSON.stringify({ contact, recentNotes: notes.slice(0, 3) });
  const result = await askAI(
    "You are a thoughtful relationship assistant. Suggest one specific, warm follow-up action in 1-2 sentences. Avoid salesy language.",
    context
  );
  if (result) return result;

  const latest = notes[0]?.summary || notes[0]?.content;
  return latest
    ? `Check in with ${contact.name} about ${latest.slice(0, 90).replace(/[.!?]+$/, "")}.`
    : `Send ${contact.name} a quick personal check-in and ask what they are focused on this week.`;
}

export async function highlightContact(contact, notes = []) {
  const result = await askAI(
    "Extract 3 important facts worth remembering about this contact. Return each fact on a new line without numbering.",
    JSON.stringify({ contact, notes: notes.slice(0, 5) })
  );
  if (result) return result.split("\n").map((line) => line.replace(/^[-*\d.)\s]+/, "")).filter(Boolean).slice(0, 3);

  return [
    contact.company && `Works at ${contact.company}`,
    contact.birthday && `Birthday is ${new Date(`${contact.birthday}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`,
    contact.notes
  ].filter(Boolean).slice(0, 3);
}
