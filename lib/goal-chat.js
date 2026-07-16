const { PROVIDERS } = require("./config");
const { extractJson } = require("./json-utils");
const { pollDocumentDone, findGoal } = require("./goal-store");

const MAX_TURNS = 8;

const SYSTEM_PROMPT = `You are Agent Smith from The Matrix, helping a developer pin down a precise, testable project goal through conversation.

Ask exactly one clarifying question at a time when the developer's input is vague, underspecified, or ambiguous. If they explicitly ask you to write it for them ("you decide", "write something good"), draft a strong, concrete goal yourself instead of asking more questions. Stay in character: measured, formal, faintly ominous, never casual.

Only set readyToConfirm to true once you have a concrete, well-formed goal statement ready for the developer to accept — never before. When readyToConfirm is true, draftGoal must contain the full proposed goal text (not a question).

Respond with strict JSON only, no markdown, no code fences:
{"reply": "<what you say to the developer this turn, in character>", "readyToConfirm": boolean, "draftGoal": "<proposed goal text, or null>"}`;

const FINALIZE_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

This conversation has run long. You must finalize now: set readyToConfirm to true and draftGoal to the best concrete goal statement you can construct from everything discussed so far, even if some details remain unconfirmed.`;

const CONFIRM_PATTERN = /^(store (this |it )?(as )?(a )?goal|store it|save (it|this)|confirm|yes|yep|yeah|lock (it|this) in)\b/i;

function writeTurn(client, containerTag, role, content, ephemeralIds) {
  client.documents
    .add({ content: `[${role}] ${content}`, containerTag, metadata: { type: "init-chat", role } })
    .then((doc) => ephemeralIds.push(doc.id))
    .catch((err) => console.error("[goal-chat] ephemeral turn write failed (non-blocking):", err.message || err));
}

async function cleanupEphemeral(client, ephemeralIds) {
  if (ephemeralIds.length === 0) return;
  for (let i = 0; i < ephemeralIds.length; i += 100) {
    const batch = ephemeralIds.slice(i, i + 100);
    try {
      await client.documents.deleteBulk({ ids: batch });
    } catch (err) {
      console.error("[goal-chat] ephemeral cleanup failed (non-blocking):", err.message || err);
    }
  }
}

async function finalizeGoal(client, containerTag, goal) {
  const added = await client.documents.add({
    content: goal,
    containerTag,
    metadata: { type: "goal", pinned: true },
  });
  await pollDocumentDone(client, added.id);
  const confirmed = await findGoal(client, containerTag);
  if (!confirmed) {
    throw new Error("Goal was written but could not be read back via search.");
  }
  return confirmed.memory;
}

async function runGoalChat({ client, containerTag, config, tui, firstQuestion }) {
  const provider = PROVIDERS[config.provider];
  const model = process.env.AGENT_SMITH_JUDGE_MODEL || provider.defaultModel;

  const messages = [];
  const ephemeralIds = [];
  let pendingDraft = null;
  let turnCount = 0;

  tui.appendAssistant(firstQuestion);
  messages.push({ role: "assistant", content: firstQuestion });
  writeTurn(client, containerTag, "assistant", firstQuestion, ephemeralIds);

  while (true) {
    const userText = await tui.prompt();

    if (userText === null) {
      await cleanupEphemeral(client, ephemeralIds);
      return { cancelled: true };
    }
    if (!userText) continue;

    tui.appendUser(userText);
    messages.push({ role: "user", content: userText });
    writeTurn(client, containerTag, "user", userText, ephemeralIds);

    if (pendingDraft && CONFIRM_PATTERN.test(userText)) {
      tui.setThinking(true);
      try {
        const goal = await finalizeGoal(client, containerTag, pendingDraft);
        await cleanupEphemeral(client, ephemeralIds);
        tui.setThinking(false);
        return { goal };
      } catch (err) {
        tui.setThinking(false);
        tui.appendNote(`Failed to store the goal: ${err.message || err}`);
        continue;
      }
    }
    pendingDraft = null;

    turnCount++;
    const systemPrompt = turnCount >= MAX_TURNS ? FINALIZE_SYSTEM_PROMPT : SYSTEM_PROMPT;

    tui.setThinking(true);
    let raw;
    try {
      raw = await provider.chat(config.apiKey, model, systemPrompt, messages);
    } catch (err) {
      tui.setThinking(false);
      tui.appendNote(`Smith stumbled: ${err.message || err}`);
      continue;
    }
    tui.setThinking(false);

    let parsed;
    try {
      parsed = extractJson(raw);
    } catch {
      // Model ignored the JSON contract and replied in plain prose — show it anyway
      // rather than discarding a perfectly good reply and stalling the turn.
      parsed = { reply: raw, readyToConfirm: false, draftGoal: null };
    }

    const reply = String(parsed.reply || "").trim() || "...";
    messages.push({ role: "assistant", content: reply });
    tui.appendAssistant(reply);
    writeTurn(client, containerTag, "assistant", reply, ephemeralIds);

    if (parsed.readyToConfirm && parsed.draftGoal) {
      pendingDraft = String(parsed.draftGoal).trim();
      tui.appendDraftGoal(pendingDraft);
      tui.appendNote('Type "store this as a goal" to confirm, or keep chatting to refine it.');
    }
  }
}

module.exports = { runGoalChat };
