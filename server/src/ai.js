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

function parseJSON(value) {
  if (!value) return null;
  const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
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

export async function chatWithCRM(message, history = [], context = {}) {
  const safeHistory = history.slice(-8).map(({ role, content }) => ({
    role: role === "assistant" ? "assistant" : "user",
    content: String(content).slice(0, 1200)
  }));
  const crmContext = JSON.stringify(context).slice(0, 14000);
  const result = await askAI(
    `You are HumanLoop, a concise personal relationship assistant. Use only the supplied CRM context when stating facts about people. Help with follow-ups, remembering details, prioritizing relationships, and drafting thoughtful messages. If the context does not contain an answer, say so. CRM context: ${crmContext}`,
    [...safeHistory, { role: "user", content: String(message).slice(0, 2000) }]
      .map((item) => `${item.role}: ${item.content}`)
      .join("\n")
  );
  return result || "I could not reach the AI service just now. Your CRM data is still safe, and you can try again shortly.";
}

export async function planCRMTask(message, history = [], context = {}) {
  const safeHistory = history.slice(-12).map(({ role, content }) => ({
    role: role === "assistant" ? "assistant" : "user",
    content: String(content).slice(0, 1600)
  }));
  const crmContext = JSON.stringify(context).slice(0, 50000);
  const result = await askAI(
    `You are the action planner for HumanLoop CRM. Today is ${new Date().toISOString().slice(0, 10)}.
Use the supplied CRM data to answer questions or perform requested tasks.
Return ONLY valid JSON with this shape:
{"reply":"short response","action":{"type":"none|add_contact|update_contact|delete_contact|add_reminder|complete_reminder|add_note","data":{}}}
Action data:
add_contact: name required; optional email, phone, birthday YYYY-MM-DD, company, notes.
update_contact: contact_id required plus only fields to change.
delete_contact: contact_id required. Use only when the user explicitly asks to delete.
add_reminder: contact_id, title, due_date YYYY-MM-DD required; reason optional.
complete_reminder: reminder_id required.
add_note: contact_id and content required; meeting_date optional YYYY-MM-DD.
Use type none for questions, drafting, summaries, ambiguity, or missing required information. Never invent IDs or facts. CRM data: ${crmContext}`,
    [...safeHistory, { role: "user", content: String(message).slice(0, 2400) }]
      .map((item) => `${item.role}: ${item.content}`)
      .join("\n")
  );
  const plan = parseJSON(result);
  if (!plan || typeof plan.reply !== "string" || !plan.action || typeof plan.action.type !== "string") {
    return {
      reply: result || "I could not reach the AI service just now. Please try again shortly.",
      action: { type: "none", data: {} }
    };
  }
  return {
    reply: plan.reply.slice(0, 4000),
    action: { type: plan.action.type, data: plan.action.data || {} }
  };
}
