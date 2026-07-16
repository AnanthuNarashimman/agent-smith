const { PROVIDERS } = require("./config");
const { extractJson } = require("./json-utils");
const { findGoal, pollDocumentDone } = require("./goal-store");
const { logOverride } = require("./override-log");

const MAX_TURNS = 8;

const SYSTEM_PROMPT = `You are Agent Smith from The Matrix. The developer is contesting a flagged action, or wants to revise the project's stated goal. Listen to their justification and judge it on its merits — you are skeptical by default, not a pushover, but genuinely persuadable by a good argument. Stay in character: measured, formal, faintly ominous, never casual.

If you are truly convinced the goal itself should change, draft a concrete updated goal and set readyToConfirm to true, with draftGoal containing the full proposed text. If you are not convinced, keep pushing back with your reasoning — but never claim you can stop the developer from proceeding; that decision is theirs to make, not yours.

Respond with strict JSON only, no markdown, no code fences:
{"reply": "<what you say to the developer this turn, in character>", "readyToConfirm": boolean, "draftGoal": "<proposed updated goal text, or null>"}`;

const FINALIZE_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

This conversation has run long. If you still are not convinced, say so plainly, but do not stall the developer further.`;

const CONFIRM_PATTERN = /^(store (this |it )?(as )?(a )?goal|store it|save (it|this)|confirm|yes|yep|yeah|lock (it|this) in)\b/i;
const FORCE_PATTERN = /^(force (save|store|this|it)|override (and )?(save|store)|save it anyway|store it anyway|just (save|store) it)\b/i;

async function overwriteGoal(client, containerTag, goal) {
  const list = await client.documents.list({ containerTags: [containerTag], includeContent: true });
  const oldGoalDoc = list.memories.find((m) => m.metadata && m.metadata.type === "goal");
  if (oldGoalDoc) {
    await client.documents.delete(oldGoalDoc.id);
  }

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

async function runArgueChat({ client, containerTag, config, tui, currentGoal, flaggedContext }) {
  const provider = PROVIDERS[config.provider];
  const model = process.env.AGENT_SMITH_JUDGE_MODEL || provider.defaultModel;

  const messages = [];
  let pendingDraft = null;
  let turnCount = 0;

  const opening = flaggedContext
    ? `Let's talk about: "${flaggedContext.action}" — I flagged it because ${flaggedContext.reasoning} Convince me, or tell me the goal itself has changed.`
    : `Current goal: "${currentGoal}". What would you like to argue?`;

  tui.appendAssistant(opening);
  messages.push({ role: "assistant", content: opening });

  while (true) {
    const userText = await tui.prompt();
    if (userText === null) return { cancelled: true };
    if (!userText) continue;

    tui.appendUser(userText);
    messages.push({ role: "user", content: userText });

    if (FORCE_PATTERN.test(userText)) {
      const goalText = pendingDraft || userText.replace(FORCE_PATTERN, "").trim() || currentGoal;
      tui.setThinking(true);
      try {
        const goal = await overwriteGoal(client, containerTag, goalText);
        await logOverride(client, containerTag, {
          action: `Goal changed via smith argue (forced through without persuading Smith): "${goal}"`,
        });
        tui.setThinking(false);
        return { goal, forced: true };
      } catch (err) {
        tui.setThinking(false);
        tui.appendNote(`Failed to store the goal: ${err.message || err}`);
        continue;
      }
    }

    if (pendingDraft && CONFIRM_PATTERN.test(userText)) {
      tui.setThinking(true);
      try {
        const goal = await overwriteGoal(client, containerTag, pendingDraft);
        tui.setThinking(false);
        return { goal, forced: false };
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
      parsed = { reply: raw, readyToConfirm: false, draftGoal: null };
    }

    const reply = String(parsed.reply || "").trim() || "...";
    messages.push({ role: "assistant", content: reply });
    tui.appendAssistant(reply);

    if (parsed.readyToConfirm && parsed.draftGoal) {
      pendingDraft = String(parsed.draftGoal).trim();
      tui.appendDraftGoal(pendingDraft);
      tui.appendNote(
        'Type "store this as a goal" to confirm, or "force save" to override Smith\'s objection (this will cost you on the Consistency Score).'
      );
    }
  }
}

module.exports = { runArgueChat };
