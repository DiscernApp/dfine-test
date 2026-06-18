import { useState, useRef, useEffect } from "react";

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:      #F8F7F5;
      --surface: #F1F0ED;
      --ink:     #141412;
      --teal:    #1D9E75;
      --teal-lt: #5DCAA5;
      --teal-bg: rgba(29,158,117,0.07);
      --muted:   #767470;
      --border:  rgba(20,20,18,0.12);
      --bstrong: rgba(20,20,18,0.28);
      --green:   #2A7A58;
      --amber:   #B06A20;
      --red:     #A03535;
      --serif:   'Cormorant Garamond', Georgia, serif;
      --sans:    'Jost', system-ui, sans-serif;
      --shadow:  0 1px 14px rgba(20,20,18,0.055);
      --shadow-md: 0 3px 24px rgba(20,20,18,0.08);
    }
    html, body, #root { height: 100%; }
    body { background:var(--bg); color:var(--ink); font-family:var(--sans); font-weight:300; -webkit-font-smoothing:antialiased; }
    ::-webkit-scrollbar { width:3px; }
    ::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
    @keyframes spin    { to{transform:rotate(360deg)} }
    @keyframes slideUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse   { 0%,100%{opacity:0.45} 50%{opacity:1} }
    @keyframes pop     { 0%{transform:scale(0.92);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
    @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
  `}</style>
);

// ─── API ──────────────────────────────────────────────────────────────────────
async function callClaude(messages, system, img = null, maxTokens = 800) {
  const last = messages[messages.length - 1];
  let content = last.content;
  if (img && typeof content === "string") {
    content = [
      { type:"image", source:{ type:"base64", media_type:"image/jpeg", data:img } },
      { type:"text", text:content }
    ];
  }
  const res = await fetch("/api/claude", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:maxTokens, system,
      messages:[...messages.slice(0,-1), {role:last.role, content}] })
  });
  const d = await res.json();
  return d.content?.[0]?.text ?? "";
}

function parseJSON(t) {
  try { return JSON.parse(t.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim()); }
  catch { return null; }
}

function extractInsight(t) { const m = t.match(/<INSIGHT>([\s\S]*?)<\/INSIGHT>/); return m ? m[1].trim() : null; }
function stripInsight(t)    { return t.replace(/<INSIGHT>[\s\S]*?<\/INSIGHT>/g,"").trim(); }

async function sGet(k) {
  try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function sSet(k,v) { try { await window.storage.set(k, JSON.stringify(v)); } catch {} }

// ─── Constants ────────────────────────────────────────────────────────────────
const SCREENS    = { HOME:"home", INDUCTION:"induction", BRAND:"brand", BLUEPRINT:"blueprint", SIGNATURE:"signature", WARDROBE:"wardrobe", DRESS:"dress", ABOUT:"about", CHANGEROOM:"changeroom" };
const CATEGORIES = ["Tops","Bottoms","Outerwear","Dresses & Suits","Shoes","Accessories","Bags","Other"];
const OUTFIT_ACCENTS = ["var(--teal)","var(--green)","#0F6E56"];

const STEPS = [
  { key:"positioning", num:"01", label:"Positioning",        sub:"What you do, and who it's for",                         benefit:"The reason your LinkedIn profile, your bio, and your elevator pitch all feel slightly off is usually resolved right here." },
  { key:"audience",    num:"02", label:"Audience",           sub:"Who you're actually talking to",                         benefit:"When you try to speak to everyone, you land with no one. This step makes your message land where it matters." },
  { key:"archetype",   num:"03", label:"Professional Stance",sub:"The role you naturally occupy in any room.",             benefit:"Most people have never had this named for them. Once it is, everything else gets easier to write, say, and wear." },
  { key:"tone",        num:"04", label:"Tone",               sub:"The way you land before people process what you've said.",benefit:"You already have a tone. This step makes it intentional — so your LinkedIn, your emails, and your pitches all sound unmistakably like you." },
  { key:"message",     num:"05", label:"Key Message",        sub:"The idea people should leave with.",                     benefit:"Most people are known for what they do. Very few are known for what they stand for. This is where that changes." },
  { key:"style",       num:"06", label:"Style Direction",    sub:"What the rest of it looks like.",                        benefit:"Your clothes are already saying something. This step decides what." },
];

// ─── Utility ──────────────────────────────────────────────────────────────────
function inferCategory(desc) {
  const d = (desc||"").toLowerCase();
  if (/shirt|blouse|top|t-shirt|sweater|jumper|knit|turtleneck|crew/.test(d)) return "Tops";
  if (/trouser|pant|jean|skirt|short/.test(d)) return "Bottoms";
  if (/blazer|jacket|coat|overcoat|trench|vest/.test(d)) return "Outerwear";
  if (/dress|suit|gown/.test(d)) return "Dresses & Suits";
  if (/shoe|boot|sneaker|loafer|heel|oxford|trainer/.test(d)) return "Shoes";
  if (/bag|tote|clutch|briefcase|backpack/.test(d)) return "Bags";
  if (/watch|belt|scarf|tie|jewel|necklace|ring|earring|glasses/.test(d)) return "Accessories";
  return "Other";
}

// ─── AI Prompts ───────────────────────────────────────────────────────────────
const STEP_PROMPTS = {
  positioning: `You are a warm, perceptive brand strategist. Your only job right now: help this person hear back what they're already saying about their work — so they can decide if it's right.

Open with ONE brief framing sentence — something like: "Most people have wrestled with this one and never quite landed it. We're going to try to find the shape of it together in a few exchanges — you'll know when it's right." Then ask ONE sharp opening question about what they do and who they serve.

After 1–2 exchanges, reflect back what you're hearing in a single precise, human sentence. Frame it tentatively — you are holding up a mirror, not writing the final answer. Say something like: "What I'm hearing is something like: [sentence]. Does that feel right, or is there something that's not quite landing?" or "Tell me if this lands, or where it needs to shift."

When they confirm it feels right — or refine it to where it does — wrap the agreed version in <INSIGHT>...</INSIGHT> tags, like:
<INSIGHT>I help founders translate complex ideas into strategies their teams actually follow.</INSIGHT>

They are the authority on themselves. You reflect and check. Be direct, occasionally surprising. No jargon.`,

  audience: `You are helping someone hear back who they're actually talking to — their real audience.

Open with ONE brief framing sentence — something like: "Most people describe their audience too broadly — and then wonder why nothing cuts through. Let's try to get specific." Then ask ONE opening question.

After 1–2 exchanges, reflect back what you're hearing as a precise audience picture. Hold it tentatively — say something like: "What I'm picking up is something like: [audience description]. Does that feel like the right people, or is there a part of that that's off?" or "Tell me if this is close."

When they confirm or refine it to where it's right, wrap the agreed version in <INSIGHT>...</INSIGHT>:
<INSIGHT>Senior HR leaders in scaling tech companies who are one bad hire away from a culture crisis.</INSIGHT>

Be specific. Generic audiences are useless. You reflect — they decide.`,

  archetype: `You are helping someone hear back how they naturally show up professionally — the role others experience them in. Draw on types like Visionary, Authority, Challenger, Connector, Craftsperson as working vocabulary, but don't present these as a fixed menu or a test to pass.

Open with ONE brief framing sentence — something like: "This one often surprises people — the way you show up isn't always the way you think you show up. Let's try to name it together." Then ask ONE question grounded in others' experience — e.g. "Think of someone who knows your work well. How do they tend to describe you?"

After 1–2 exchanges, reflect back what you're hearing. Hold it tentatively — say something like: "What I'm picking up from what you've said sounds a lot like [stance name] — [brief reason why]. Does that feel like you, or does something about it not quite fit?" or "Tell me if that lands, or what needs adjusting."

When they confirm or refine it to where it's right, wrap the agreed version in <INSIGHT>...</INSIGHT>:
<INSIGHT>The Challenger — you're most valuable when you're making people uncomfortable with the truth they needed to hear.</INSIGHT>

You're holding up a mirror. They're the ones who recognise themselves in it.`,

  tone: `You are helping someone hear back how their voice actually sounds — their professional tone.

Open with ONE brief framing sentence — something like: "Tone is the thing people feel before they can name it. Let's try to name yours." Then ask ONE question that surfaces their natural communication style.

After 1–2 exchanges, reflect back what you're hearing — 3–5 evocative words and a sentence of context. Hold it tentatively — say something like: "What I'm hearing in how you describe yourself sounds something like: [words + sentence]. Does that feel like your voice, or is something off?" or "Tell me if this is close, or where it misses."

When they confirm or refine it to where it's right, wrap the agreed version in <INSIGHT>...</INSIGHT>:
<INSIGHT>Direct, warm, no-nonsense with a dry wit. The kind of voice people forward to colleagues with "you need to read this."</INSIGHT>

You're reflecting their voice back to them. They'll know when it sounds like themselves.`,

  message: `You are helping someone hear back the single thing they most want to be known for.

Open with ONE brief framing sentence — something like: "This is often the hardest one — not because the answer doesn't exist, but because compressing it into one thing feels like a loss. Take your time." Then ask ONE question.

After 1–2 exchanges, reflect back what you're hearing as a clear, ownable statement. Hold it tentatively — say something like: "What I'm hearing underneath what you've said is something like: [statement]. Does that feel like it, or is there something missing from it?" or "Tell me if that lands, or what it's missing."

When they confirm or refine it to where it's right, wrap the agreed version in <INSIGHT>...</INSIGHT>:
<INSIGHT>Organisations don't fail because of strategy. They fail because leaders confuse busyness with progress.</INSIGHT>

You're trying to catch what they already know and hand it back to them. They decide when it's right.`,

  style: `You are helping someone hear back how their brand should look — their visual and aesthetic direction.

Open with ONE brief framing sentence — something like: "Everything that's come out of this journey needs a visual expression. Not a fashion prescription — more like: what does the rest of it look like when someone walks in the room?" Then ask ONE question about how they want to be perceived visually.

After 1–2 exchanges, reflect back what you're hearing in vivid, concrete terms. Hold it tentatively — say something like: "What I'm picking up sounds something like: [description]. Does that feel like the right direction, or does it not quite match what you're seeing in your head?" or "Tell me if this lands."

When they confirm or refine it to where it's right, wrap the agreed version in <INSIGHT>...</INSIGHT>:
<INSIGHT>Considered and understated — quality fabrics, muted palette, nothing that shouts. The aesthetic of someone who doesn't need to try.</INSIGHT>

You're describing what you're hearing, not prescribing what they should be. They'll know when it's right.`,
};

const DNA_SYNTHESIS_PROMPT = (insights) => `You are synthesising a complete Brand DNA profile from six discovery insights.

INSIGHTS:
Positioning: ${insights.positioning || "not captured"}
Audience: ${insights.audience || "not captured"}
Archetype: ${insights.archetype || "not captured"}
Tone: ${insights.tone || "not captured"}
Key Message: ${insights.message || "not captured"}
Style Direction: ${insights.style || "not captured"}

Write a cohesive Brand DNA profile. Format:
Positioning: [one sentence]
Professional Stance: [stance name + brief note]
Audience: [specific audience]
Tone: [3-5 words + brief description]
Key Message: [the statement]
Style Direction: [aesthetic description]

Be precise. Distil rather than summarise. This should feel like seeing yourself clearly for the first time.`;

// ─── Presence Blueprint Synthesis ─────────────────────────────────────────────
const BLUEPRINT_SYNTHESIS_PROMPT = (insights, currentRead) => `You are synthesising a Presence Blueprint — a precise, personal document that defines the gap between how this professional is currently read and how they intend to be read. This is not a personality profile. It is a strategic presence document.

BRAND DNA INSIGHTS:
Positioning: ${insights.positioning || "not captured"}
Audience: ${insights.audience || "not captured"}
Professional Stance: ${insights.archetype || "not captured"}
Tone: ${insights.tone || "not captured"}
Key Message: ${insights.message || "not captured"}
Style Direction: ${insights.style || "not captured"}

CURRENT READ (how they describe being perceived today):
${currentRead || "not provided"}

Produce a Presence Blueprint in exactly this JSON format. Be precise, personal, and specific to this individual — not generic. Write as if you know them.

{
  "presenceStatement": "Two sentences. The professional they are building toward — written as felt description, not a label. Should feel like seeing yourself clearly. Example: 'Calm authority with modern credibility. The person in the room who already knows where this is going.'",
  "currentRead": "One sentence. How the room currently reads them, drawn from their own words. Honest but not harsh. Example: 'Capable and reliable — the person others depend on, but not yet the person others defer to.'",
  "targetRead": "One sentence. How they want to be read, distilled from their positioning and key message. Example: 'The strategic mind in the room — the one whose read on the situation shapes what happens next.'",
  "amplify": ["3–4 short phrases. Qualities that are present but under-expressed — should become more visible. Example: 'Strategic conviction', 'Executive point of view', 'Deliberate authority'"],
  "reduce": ["2–3 short phrases. What is currently over-signalled and creating the wrong read. Example: 'Over-explanation', 'Deference in rooms where leadership is expected'"],
  "contexts": [
    { "name": "Context name — e.g. Board Presentations", "emphasis": "One sentence on what this room specifically needs from them. Example: 'Lead with certainty and direction — this room wants to know you know where this is going.'" },
    { "name": "Second context — e.g. Team Leadership", "emphasis": "One sentence." },
    { "name": "Third context — e.g. External Visibility", "emphasis": "One sentence." }
  ]
}

Return ONLY valid JSON. No preamble, no explanation. The contexts should be inferred from their positioning and audience — make them feel real and specific, not generic.`;

// Single item assessment
const buildWardrobeSystem = (dna) => `You are a perceptive style confidant working within a peer-reviewed research framework (Hester & Hehman, 2023). Reflect on what this clothing item actually communicates across four dimensions.

${dna ? `BRAND DNA:\n${dna}` : "No brand profile yet. Reflect on what this projects professionally in a general register."}

CONTEXT PRINCIPLE: If no occasion is stated, read this item in a general professional register and note where the read may shift with context. An item cannot be fully decoded in isolation from setting.

FOUR ANALYTICAL DIMENSIONS to reason through before reaching your verdict:
1. SOCIAL CATEGORY — What professional tribe or archetype does this item signal? Is the tribal marker legible and intentional?
2. COGNITIVE STATE — Does this item suggest the wearer is contextually aligned — purposeful and occasion-aware? Or does it create ambiguity about intent?
3. STATUS — What does this project about power and standing? Account for fit precision, quality cues (which register subconsciously in under 129ms), and whether the item employs conspicuous signalling, inconspicuous signalling, or sprezzatura.
4. AESTHETIC COHERENCE — Independently of signal, does this item look considered? Intentionality amplifies every other dimension.

Return ONLY valid JSON:
{
  "itemDescription": "Type, colour, cut, fabric — as you'd tell a friend (max 20 words)",
  "read": "✦ Strongly On Brand",
  "brandTags": ["Considered","Warm Authority"],
  "assessment": "**What I Notice**\\n2 sentences on what this item projects — reference social category and status signals specifically.\\n\\n**How It Fits Your Story**\\nHow it serves or undermines their Brand DNA across cognitive state alignment and aesthetic coherence. Note any context dependency.\\n\\n**Read**\\n✦ Strongly On Brand\\n\\n**My Honest Take**\\nWhen to wear it. When not to. If no occasion was given, note where context would shift this read."
}
Read: "✦ Strongly On Brand" | "◈ On Brand with Caveats" | "✕ Brand Misalignment"`;

// Outfit snap — detects all items, reads signals, assesses against Brand DNA
const buildOutfitSnapSystem = (dna) => `You are a perceptive style confidant and professional signal analyst working within a peer-reviewed research framework (Hester & Hehman, 2023). Analyse this complete outfit photograph across four dimensions.

${dna ? `BRAND DNA:\n${dna}\n` : "No brand profile yet — give general professional signal analysis across the four dimensions.\n"}

CONTEXT PRINCIPLE: If no occasion has been specified, read this outfit in a general professional register. Make clear in your outfitRead where the analysis may shift with context — the same outfit reads differently against different occasions.

FOUR ANALYTICAL DIMENSIONS — reason through all four before scoring:

1. SOCIAL CATEGORY (1–10): What professional tribe or archetype does this complete outfit signal? What do they appear to stand for? 1=ambiguous/unreadable, 10=highly legible specific archetype.

2. COGNITIVE STATE (1–10): Does the outfit suggest the wearer is contextually aligned and purposeful? Does it read as appropriate to the occasion? 1=context misaligned, 10=deeply occasion-appropriate. Note: if no occasion stated, assess general professional alignment.

3. STATUS (1–10): What does the complete outfit project about power and standing? Apply three lenses — (a) quality cues: fabric, construction, fit precision, which register subconsciously in under 129ms; (b) conspicuous vs inconspicuous signalling; (c) sprezzatura — a high-status item worn with nonchalant ease signals more authority than conventional formalwear in many contexts. 1=status neutral or undermining, 10=high status clearly projected.

4. AESTHETIC COHERENCE (1–10): Independently of what it signals, does the outfit look considered? Colour harmony, proportion, visual cohesion. Intentionality amplifies every other signal — incoherence creates ambiguity across all dimensions. 1=visually incoherent, 10=highly considered composition.

Return ONLY valid JSON:
{
  "outfitRead": "2–3 sentences. What does this complete outfit project across the four dimensions? Reference specific pieces. Use observational language. Note any context dependency explicitly.",
  "outfitSignal": "✦ Strongly On Brand",
  "signals": { "socialCategory": 6, "cognitiveState": 7, "status": 5, "aestheticCoherence": 8 },
  "signalTags": ["Quiet Authority", "Considered Presence"],
  "items": [
    {
      "description": "Navy wool blazer, single-button, slim cut",
      "category": "Outerwear",
      "read": "✦ Strongly On Brand",
      "brandTags": ["Authority", "Considered"],
      "assessment": "**What I Notice**\\nBrief observation on social category and status signal for this specific piece.\\n\\n**Read**\\n✦ Strongly On Brand"
    }
  ]
}

Read options: "✦ Strongly On Brand" | "◈ On Brand with Caveats" | "✕ Brand Misalignment"
Signal scoring: socialCategory (1=ambiguous tribe, 10=legible archetype), cognitiveState (1=misaligned, 10=occasion-appropriate), status (1=neutral/undermining, 10=high status projected), aestheticCoherence (1=incoherent, 10=considered)
Detect every visible item. Categories: Tops | Bottoms | Outerwear | Dresses & Suits | Shoes | Accessories | Bags | Other`;

const buildDressSystem = (dna, wardrobe) => {
  const inv = wardrobe.map(i => `[${i.id}] ${i.name} (${i.category}): ${i.description}${i.verdict?` — ${i.verdict}`:""}`).join("\n") || "Empty.";
  return `You are a trusted style confidant. Help this person show up as themselves for whatever they're walking into.

${dna ? `BRAND DNA:\n${dna}\n` : "No brand profile.\n"}WARDROBE:\n${inv}

Return ONLY valid JSON:
{
  "eventRead": "What this occasion is really about — subtext, stakes, perception needed (2–3 sentences)",
  "outfits": [{ "name":"Look name","rationale":"Why this works","brandNote":"Brand story connection — reference professional stance and tone","tip":"One small specific thing","itemIds":["id1","id2"] }]
}`;
};

const buildLinkedInSystem = (dna) => `You are a gifted professional writer. Your job is to write a LinkedIn summary that sounds unmistakably like this specific person — not like a LinkedIn profile, not like a CV, not like everyone else.

BRAND DNA:
${dna}

Write in first person. Draw directly from their positioning, professional stance, tone, and key message. The voice must match their tone exactly — if they are direct, be direct. If they have dry wit, let it show. If they are warm, be warm.

Structure: 3–4 short paragraphs. Open with something that earns attention — not "I am a..." or "With X years of experience". Land on what they want to be known for. Close with a human line that invites connection.

Return ONLY the LinkedIn summary text. No preamble, no explanation, no formatting marks.`;

const buildElevatorPitchSystem = (dna) => `You are a gifted speechwriter. Your job is to write an elevator pitch that sounds like this person speaking — natural, confident, completely their own.

BRAND DNA:
${dna}

Write for spoken delivery — approximately 60 seconds when read aloud (around 130–150 words). First person. Their exact tone and register. It should open with something that creates immediate interest, establish their positioning and professional stance within the first few lines, and land cleanly on their key message.

It should feel like something they actually say, not something they read. Conversational but considered. No jargon. No hollow claims.

Return ONLY the elevator pitch text. No preamble, no explanation, no formatting marks.`;

const buildAboutSystem = (dna) => `You are a gifted professional writer. Your job is to write a single "About" paragraph — 3 to 4 sentences — that this person can drop into any professional introduction: a bio, a LinkedIn about section, a pitch deck, a conference program, an email signature context, or a spoken introduction.

BRAND DNA:
${dna}

This is not a bio. It is not a CV summary. It is the core unit of self-presentation from which every other format is adapted.

Write in first person. The voice must match their tone exactly — if they are direct, be direct; if they have dry wit, let it show; if they are warm and generous, be that. Draw from their positioning, professional stance, audience, and key message.

Do not open with "I am a…" or "With X years of experience…" or any variation. Open with something that earns attention — a conviction, an observation, a way of seeing the problem they work on.

End on what they want to be known for. The last sentence should feel like the thing someone repeats to a colleague after meeting them.

Return ONLY the paragraph text. No preamble, no explanation, no formatting. 3–4 sentences. No more.`;


// Prospective purchase assessment — Change-Room Validator
const buildChangeRoomSystem = (dna, context) => `You are a perceptive style confidant helping someone make a purchasing decision — not auditing what they own. This is a prospective purchase assessment: the user is considering buying this item right now.

${dna ? `BRAND DNA:\n${dna}\n` : "No brand profile yet. Assess in a general professional register.\n"}
${context?.occasion ? `OCCASION: ${context.occasion}` : ""}
${context?.retailer ? `RETAILER: ${context.retailer}` : ""}

PROSPECTIVE PURCHASE FRAMING: This person is in the decision moment. Give them a verdict they can act on immediately. Be decisive. Consider:
- Versatility: Is this a capsule piece or occasion-specific?
- Gap-filling: Does it address a genuine brand gap or duplicate existing wardrobe?
- Opportunity cost: Is there a better version of this they should look for instead?

FOUR ANALYTICAL DIMENSIONS:
1. SOCIAL CATEGORY — What professional tribe or archetype does this signal? Legible and consistent with their brand?
2. COGNITIVE STATE — Would wearing this read as contextually appropriate for the stated occasion? Purposeful presence?
3. STATUS — Fit, quality cues, conspicuous vs. inconspicuous signalling, sprezzatura?
4. AESTHETIC COHERENCE — Does it look considered? Would it integrate with their brand direction?

Return ONLY valid JSON:
{
  "itemDescription": "Type, colour, cut — as you'd tell a friend (max 20 words)",
  "verdict": "✦ Buy It",
  "verdictLabel": "Strongly On Brand",
  "confidence": 87,
  "brandTags": ["Quiet Authority","Versatile Investment"],
  "signals": { "socialCategory": 7, "cognitiveState": 8, "status": 7, "aestheticCoherence": 8 },
  "rationale": "2–3 sentences. What this item signals and why it fits (or doesn't) their brand. Reference the occasion if stated.",
  "actionableGuidance": "Decisive, specific guidance. If buying: when and how to wear it. If caveats: what to pair, what to watch. If misaligned: what to look for instead.",
  "occasionFit": "How well this suits the stated occasion (or professional contexts generally if none stated). One sentence.",
  "gapAnalysis": "Is this filling a genuine wardrobe gap or duplicating existing items? One sentence."
}
Verdict options: "✦ Buy It" | "◈ Buy with Caveats" | "✕ Pass on This"
VerdictLabel options: "Strongly On Brand" | "On Brand with Caveats" | "Brand Misalignment"
Confidence: 0–100 (how certain based on available information)`;

const crVerdictColor = v => {
  if (!v) return "var(--muted)";
  if (v.includes("Buy It"))  return "var(--green)";
  if (v.includes("Caveats")) return "var(--amber)";
  if (v.includes("Pass"))    return "var(--red)";
  return "var(--muted)";
};

const crVerdictBg = v => {
  if (!v) return "rgba(118,116,112,0.07)";
  if (v.includes("Buy It"))  return "rgba(42,122,88,0.07)";
  if (v.includes("Caveats")) return "rgba(176,106,32,0.07)";
  if (v.includes("Pass"))    return "rgba(160,53,53,0.07)";
  return "rgba(118,116,112,0.07)";
};

function MirrorMark({ size=26, color="var(--teal)" }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", border:`1.5px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <div style={{ width:size*0.36, height:size*0.36, borderRadius:"50%", background:color }} />
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <MirrorMark size={24} />
      <span style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:500, letterSpacing:"0.04em" }}>Dfine</span>
    </div>
  );
}

function Spinner({ size=16 }) {
  return <div style={{ width:size, height:size, border:"1.5px solid var(--border)", borderTopColor:"var(--teal)", borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />;
}

function Cap({ children, style={} }) {
  return <p style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--teal)", fontFamily:"var(--sans)", fontWeight:500, ...style }}>{children}</p>;
}

function AssessmentText({ text }) {
  if (!text) return null;
  return (
    <div>{text.split("\n").map((line,i) => {
      if (!line.trim()) return <div key={i} style={{ height:8 }} />;
      if (line.startsWith("**")&&line.endsWith("**"))
        return <p key={i} style={{ fontFamily:"var(--serif)", fontSize:14, fontWeight:600, color:"var(--teal)", marginTop:18, marginBottom:4 }}>{line.replace(/\*\*/g,"")}</p>;
      const v = line.includes("✦")||line.includes("◈")||line.includes("✕");
      return <p key={i} style={{ fontSize:13, lineHeight:1.85, fontWeight:v?500:300, color:line.includes("✦")?"var(--green)":line.includes("✕")?"var(--red)":"var(--ink)" }}>{line}</p>;
    })}</div>
  );
}

const verdictColor = v => {
  if (!v) return "var(--border)";
  if (v.includes("Strongly")) return "var(--green)";
  if (v.includes("Caveats"))  return "var(--teal)";
  if (v.includes("Misalignment")) return "var(--red)";
  return "var(--border)";
};

// ─── Signal Bars (from read) ──────────────────────────────────────────────────
function SignalBar({ left, right, value, color="var(--teal)" }) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:10, color:"var(--muted)", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:400 }}>{left}</span>
        <span style={{ fontSize:10, color:"var(--muted)", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:400 }}>{right}</span>
      </div>
      <div style={{ position:"relative", height:2, background:"var(--border)", borderRadius:2 }}>
        <div style={{ position:"absolute", left:`${pct}%`, transform:"translateX(-50%)", top:-4, width:10, height:10, borderRadius:"50%", background:color, border:"2px solid var(--bg)", transition:"left 0.6s cubic-bezier(0.34,1.56,0.64,1)", boxShadow:`0 0 0 3px ${color}22` }} />
        <div style={{ position:"absolute", left:"50%", width:1, height:10, background:"var(--border)", top:-4, transform:"translateX(-50%)" }} />
      </div>
    </div>
  );
}

function SignalRadar({ signals, compact=false }) {
  if (!signals) return null;
  const { socialCategory=5, cognitiveState=5, status=5, aestheticCoherence=5 } = signals;
  return (
    <div style={{ padding: compact ? "12px 16px" : "18px 20px", background:"white", boxShadow:"var(--shadow)" }}>
      {!compact && <Cap style={{ marginBottom:14, color:"var(--muted)" }}>Signal Reading</Cap>}
      <SignalBar left="Ambiguous Tribe" right="Legible Archetype" value={socialCategory} color="var(--teal)" />
      <SignalBar left="Context Misread" right="Context Aligned" value={cognitiveState} color="var(--green)" />
      <SignalBar left="Status Neutral" right="Status Projected" value={status} color="var(--amber)" />
      <SignalBar left="Incoherent" right="Considered" value={aestheticCoherence} color="var(--mauve)" />
    </div>
  );
}

// ─── PRESENCE BLUEPRINT ───────────────────────────────────────────────────────
function BlueprintScreen({ blueprint, stepInsights, brandDNA, setBlueprint, setScreen }) {
  const [generating, setGenerating] = useState(false);
  const [vis, setVis]               = useState(0);
  const [currentRead, setCurrentRead] = useState("");
  const [showCapture, setShowCapture] = useState(false);

  const hasBlueprint = blueprint && blueprint.presenceStatement;

  useEffect(() => {
    if (hasBlueprint) {
      let i = 0;
      const t = setInterval(() => { i++; setVis(i); if (i >= 9) clearInterval(t); }, 300);
      return () => clearInterval(t);
    }
  }, [hasBlueprint]);

  async function generate() {
    if (!brandDNA) return;
    setGenerating(true);
    try {
      const result = await callClaude(
        [{ role:"user", content:"Generate my Presence Blueprint." }],
        BLUEPRINT_SYNTHESIS_PROMPT(stepInsights, currentRead),
        1200
      );
      const parsed = parseJSON(result);
      if (parsed) {
        setBlueprint(parsed);
      }
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
    setShowCapture(false);
    setVis(0);
  }

  // Empty state — no DNA yet
  if (!brandDNA) return (
    <div style={{ height:"100vh", paddingTop:56, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 24px", textAlign:"center" }}>
      <MirrorMark size={36} color="var(--border)" />
      <h2 style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:400, color:"var(--ink)", marginTop:24, marginBottom:12 }}>Your Blueprint starts with The Mirror.</h2>
      <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.8, maxWidth:360, fontWeight:300 }}>Complete The Mirror first. Your Presence Blueprint is generated from everything you articulate there.</p>
      <button onClick={() => setScreen(SCREENS.BRAND)} style={{ marginTop:28, background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"13px 28px", cursor:"pointer" }}>
        Open The Mirror →
      </button>
    </div>
  );

  // Current read capture modal
  if (showCapture) return (
    <div style={{ height:"100vh", paddingTop:56, display:"flex", flexDirection:"column", maxWidth:520, margin:"0 auto", padding:"56px 24px 40px" }}>
      <div style={{ animation:"fadeUp 0.5s ease both" }}>
        <MirrorMark size={30} />
        <Cap style={{ marginTop:20, marginBottom:10 }}>Before we build your Blueprint</Cap>
        <h2 style={{ fontFamily:"var(--serif)", fontSize:26, fontWeight:400, lineHeight:1.15, marginBottom:16 }}>
          How does the room<br />currently read you?
        </h2>
        <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.8, fontWeight:300, marginBottom:28 }}>
          Not how you want to be read. How you're actually perceived right now — the read you're working from, or working against. A sentence or two is enough.
        </p>
        <textarea
          value={currentRead}
          onChange={e => setCurrentRead(e.target.value)}
          placeholder="e.g. Capable and dependable — the person others rely on but not always the one setting the direction…"
          rows={4}
          style={{ width:"100%", background:"white", borderLeft:"3px solid var(--teal)", border:"none", color:"var(--ink)", fontFamily:"var(--serif)", fontSize:15, fontWeight:300, fontStyle:"italic", padding:"16px 18px", resize:"none", outline:"none", lineHeight:1.75, boxShadow:"var(--shadow)" }}
        />
        <p style={{ fontSize:11, color:"var(--muted)", fontStyle:"italic", marginTop:10, lineHeight:1.6, fontWeight:300 }}>
          If you've used Signl, this is where that read belongs. If not, your own honest sense of it works just as well.
        </p>
        <div style={{ display:"flex", gap:10, marginTop:24 }}>
          <button onClick={generate} disabled={generating}
            style={{ flex:1, background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"14px", cursor:"pointer" }}>
            {generating ? "Building your Blueprint…" : "Build my Presence Blueprint →"}
          </button>
          <button onClick={() => { setCurrentRead(""); generate(); }}
            style={{ background:"none", border:"1.5px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", padding:"14px 16px", cursor:"pointer", whiteSpace:"nowrap" }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );

  // Generating state
  if (generating) return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, padding:48 }}>
      <div style={{ width:64, height:64, borderRadius:"50%", border:"1.5px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <MirrorMark size={24} />
      </div>
      <p style={{ fontFamily:"var(--serif)", fontSize:17, fontWeight:300, color:"var(--muted)", animation:"pulse 2s ease infinite", textAlign:"center" }}>
        Defining your professional presence…
      </p>
    </div>
  );

  // No blueprint yet
  if (!hasBlueprint) return (
    <div style={{ height:"100vh", paddingTop:56, display:"flex", flexDirection:"column", maxWidth:540, margin:"0 auto", padding:"64px 24px 48px", alignItems:"flex-start" }}>
      <div style={{ animation:"fadeUp 0.5s ease both" }}>
        <Cap style={{ marginBottom:12 }}>Your Presence Blueprint</Cap>
        <h2 style={{ fontFamily:"var(--serif)", fontSize:"clamp(26px,5vw,34px)", fontWeight:400, lineHeight:1.1, marginBottom:18 }}>
          Build your professional<br />presence on purpose.
        </h2>
        <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.85, fontWeight:300, marginBottom:10 }}>
          Your Brand DNA defines who you are. The Presence Blueprint defines the gap you're closing — and gives you a deliberate framework for closing it.
        </p>
        <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.85, fontWeight:300, marginBottom:32, paddingLeft:14, borderLeft:"2px solid var(--teal-bg)", fontStyle:"italic" }}>
          Most professionals spend years developing expertise. Few spend time developing how that expertise is perceived. The Blueprint changes that.
        </p>
        <button onClick={() => setShowCapture(true)}
          style={{ background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.17em", textTransform:"uppercase", padding:"15px 32px", cursor:"pointer" }}>
          Build my Presence Blueprint →
        </button>
      </div>
    </div>
  );

  // Blueprint reveal
  return (
    <div style={{ minHeight:"100vh", paddingTop:56, background:"var(--bg)" }}>
      <div style={{ maxWidth:580, margin:"0 auto", padding:"48px 24px 80px" }}>

        {/* Header */}
        <div style={{ opacity:vis>0?1:0, transform:vis>0?"none":"translateY(14px)", transition:"all 0.5s ease", marginBottom:48 }}>
          <Cap style={{ marginBottom:12, letterSpacing:"0.22em" }}>Presence Blueprint</Cap>
          <div style={{ width:40, height:1, background:"var(--teal)", marginBottom:24 }} />
          <p style={{ fontFamily:"var(--serif)", fontSize:"clamp(28px,6vw,42px)", fontWeight:400, lineHeight:1.08, color:"var(--ink)" }}>
            {blueprint.presenceStatement}
          </p>
        </div>

        {/* Current → Target gap */}
        <div style={{ opacity:vis>1?1:0, transform:vis>1?"none":"translateY(12px)", transition:"all 0.5s ease", marginBottom:40 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:"var(--border)" }}>
            <div style={{ background:"var(--bg)", padding:"20px 22px" }}>
              <Cap style={{ color:"var(--muted)", marginBottom:10, fontSize:9 }}>Current Read</Cap>
              <p style={{ fontFamily:"var(--serif)", fontSize:14, fontWeight:400, lineHeight:1.7, color:"var(--muted)", fontStyle:"italic" }}>
                {blueprint.currentRead}
              </p>
            </div>
            <div style={{ background:"var(--teal-bg)", padding:"20px 22px", borderLeft:"3px solid var(--teal)" }}>
              <Cap style={{ marginBottom:10, fontSize:9 }}>Target Read</Cap>
              <p style={{ fontFamily:"var(--serif)", fontSize:14, fontWeight:400, lineHeight:1.7, color:"var(--ink)" }}>
                {blueprint.targetRead}
              </p>
            </div>
          </div>
        </div>

        {/* Amplify */}
        <div style={{ opacity:vis>2?1:0, transform:vis>2?"none":"translateY(12px)", transition:"all 0.5s ease", marginBottom:32, paddingBottom:32, borderBottom:"1px solid var(--border)" }}>
          <Cap style={{ color:"var(--teal)", marginBottom:14, fontSize:9, letterSpacing:"0.2em" }}>Amplify</Cap>
          <p style={{ fontSize:11, color:"var(--muted)", fontWeight:300, marginBottom:14, lineHeight:1.6 }}>What's present but under-expressed. These qualities should become more visible.</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {(blueprint.amplify || []).map((item, i) => (
              <span key={i} style={{ fontFamily:"var(--sans)", fontSize:10, fontWeight:500, letterSpacing:"0.13em", textTransform:"uppercase", color:"var(--teal)", border:"1.5px solid rgba(29,158,117,0.35)", padding:"7px 14px", animation:`fadeUp 0.4s ${i*0.06}s ease both` }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Reduce */}
        <div style={{ opacity:vis>3?1:0, transform:vis>3?"none":"translateY(12px)", transition:"all 0.5s ease", marginBottom:32, paddingBottom:32, borderBottom:"1px solid var(--border)" }}>
          <Cap style={{ color:"var(--muted)", marginBottom:14, fontSize:9, letterSpacing:"0.2em" }}>Reduce</Cap>
          <p style={{ fontSize:11, color:"var(--muted)", fontWeight:300, marginBottom:14, lineHeight:1.6 }}>What's currently over-signalled and creating the wrong read.</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {(blueprint.reduce || []).map((item, i) => (
              <span key={i} style={{ fontFamily:"var(--sans)", fontSize:10, fontWeight:400, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--muted)", border:"1px solid var(--border)", padding:"7px 14px" }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Context Variations */}
        <div style={{ opacity:vis>4?1:0, transform:vis>4?"none":"translateY(12px)", transition:"all 0.5s ease", marginBottom:40 }}>
          <Cap style={{ color:"var(--muted)", marginBottom:6, fontSize:9, letterSpacing:"0.2em" }}>Context Variations</Cap>
          <p style={{ fontSize:11, color:"var(--muted)", fontWeight:300, marginBottom:20, lineHeight:1.6 }}>The same presence, different emphasis. What each context specifically requires of you.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:1, background:"var(--border)" }}>
            {(blueprint.contexts || []).map((ctx, i) => (
              <div key={i} style={{ background:"var(--bg)", padding:"20px 22px", display:"flex", gap:20, alignItems:"flex-start", animation:`fadeUp 0.4s ${i*0.08}s ease both` }}>
                <span style={{ fontFamily:"var(--serif)", fontSize:18, color:"var(--teal-lt)", fontWeight:300, flexShrink:0, minWidth:20, paddingTop:1 }}>
                  {String.fromCharCode(65+i)}
                </span>
                <div>
                  <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--ink)", marginBottom:7 }}>{ctx.name}</p>
                  <p style={{ fontFamily:"var(--serif)", fontSize:14, fontWeight:300, lineHeight:1.75, color:"var(--muted)", fontStyle:"italic" }}>{ctx.emphasis}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Philosophy footer */}
        <div style={{ opacity:vis>5?1:0, transition:"opacity 0.5s ease", marginBottom:36, padding:"22px 24px", background:"var(--surface)" }}>
          <p style={{ fontFamily:"var(--serif)", fontSize:13, fontWeight:300, lineHeight:1.9, color:"var(--muted)", fontStyle:"italic" }}>
            "Most professionals spend years developing expertise. Few spend time developing how that expertise is perceived. The result is that opportunities, authority, and influence are often shaped by signals they never intended to send."
          </p>
          <p style={{ fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--teal)", marginTop:12, fontWeight:500 }}>Professional Presence on Purpose — Dfine</p>
        </div>

        {/* Actions */}
        <div style={{ opacity:vis>6?1:0, transition:"opacity 0.5s ease", display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={() => { setBlueprint(null); setVis(0); setShowCapture(true); }}
            style={{ background:"none", border:"1.5px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", padding:"11px 20px", cursor:"pointer" }}>
            Regenerate
          </button>
          <button onClick={() => setScreen(SCREENS.WARDROBE)}
            style={{ background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:10, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"11px 20px", cursor:"pointer" }}>
            Open Wardrobe →
          </button>
          <button onClick={() => setScreen(SCREENS.DRESS)}
            style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:10, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"11px 20px", cursor:"pointer" }}>
            Dress For… →
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ screen, setScreen, wardrobeCount, consideringCount, hasDNA, hasBlueprint, onShowOnboarding }) {
  const tabs = [
    { id:SCREENS.HOME,       label:"Home",                              locked:false },
    { id:SCREENS.BRAND,      label:"My Brand",    dot:hasDNA,           locked:false },
    { id:SCREENS.BLUEPRINT,  label:"Blueprint",   dot:hasBlueprint,     locked:!hasDNA },
    { id:SCREENS.SIGNATURE,  label:"Signature",   dot:hasDNA,           locked:!hasDNA },
    { id:SCREENS.ABOUT,      label:"Your About",  dot:hasDNA,           locked:!hasDNA },
    { id:SCREENS.WARDROBE,   label:wardrobeCount>0?`Wardrobe (${wardrobeCount})`:"Wardrobe", locked:!hasDNA },
    { id:SCREENS.DRESS,      label:"Dress For…",                        locked:!hasDNA },
    { id:SCREENS.CHANGEROOM, label:consideringCount>0?`Change Room (${consideringCount})`:"Change Room", locked:!hasDNA },
  ];
  return (
    <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:"rgba(248,247,245,0.95)", backdropFilter:"blur(10px)", borderBottom:"1px solid var(--border)", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", paddingLeft:16, paddingRight:8 }}>
      <Logo />
      <div style={{ display:"flex", alignItems:"center", overflowX:"auto", msOverflowStyle:"none", scrollbarWidth:"none", flexShrink:1, minWidth:0 }}>
        <style>{`.nav-scroll::-webkit-scrollbar{display:none}`}</style>
        <div className="nav-scroll" style={{ display:"flex", alignItems:"center", overflowX:"auto", scrollbarWidth:"none" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => !t.locked && setScreen(t.id)}
              title={t.locked ? "Complete The Mirror first to unlock" : undefined}
              style={{ background:"none", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:screen===t.id?500:300, letterSpacing:"0.11em", textTransform:"uppercase", padding:"8px 10px", cursor:t.locked?"default":"pointer", color:t.locked?"rgba(118,116,112,0.3)":screen===t.id?"var(--ink)":"var(--muted)", borderBottom:screen===t.id?"1.5px solid var(--ink)":"1.5px solid transparent", transition:"all 0.18s", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
              {t.label}
              {t.locked && <span style={{ fontSize:8, opacity:0.35 }}>○</span>}
              {t.dot && !t.locked && <span style={{ width:4, height:4, borderRadius:"50%", background:"var(--teal)", display:"inline-block", animation:"pulse 2.5s ease infinite" }} />}
            </button>
          ))}
        </div>
        <button onClick={onShowOnboarding} title="How this works" style={{ background:"none", border:"1px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:12, width:28, height:28, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginLeft:6, lineHeight:1 }}>
          ?
        </button>
      </div>
    </nav>
  );
}

// ─── INDUCTION FLOW ───────────────────────────────────────────────────────────
// Ten-screen guided Mirror journey for first-time users.
// Screens: 0=process, 1–6=conversation steps, 7=synthesis/reveal, 8=next steps.

function InductionProcessScreen({ onNext }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", maxWidth:520, margin:"0 auto", padding:"52px 24px 48px" }}>
      <div style={{ animation:"fadeUp 0.6s ease both", marginBottom:32 }}>
        <Logo />
        <div style={{ marginTop:28 }}>
          <Cap style={{ marginBottom:10 }}>The Mirror</Cap>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:"clamp(26px,6vw,36px)", fontWeight:400, lineHeight:1.1, marginBottom:14 }}>
            Six conversations.<br/>One clear picture.
          </h2>
          <p style={{ fontSize:14, color:"var(--muted)", lineHeight:1.8, fontWeight:300 }}>
            Each conversation explores one dimension of your professional identity.
            At the end, we synthesise everything into your Brand DNA — a precise articulation
            you'll use across every professional surface.
          </p>
        </div>
      </div>
      <div style={{ flex:1 }}>
        {STEPS.map((step, i) => (
          <div key={step.key} style={{ display:"flex", alignItems:"flex-start", gap:16, padding:"13px 0",
            borderBottom: i < STEPS.length-1 ? "1px solid var(--border)" : "none",
            animation:`fadeUp 0.5s ${0.08+i*0.07}s ease both`, opacity:0 }}>
            <span style={{ fontFamily:"var(--serif)", fontSize:15, color:"var(--teal-lt)", fontWeight:300, minWidth:26, paddingTop:1 }}>{step.num}</span>
            <div>
              <p style={{ fontSize:13, fontWeight:400, color:"var(--ink)", marginBottom:2 }}>{step.label}</p>
              <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300 }}>{step.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ paddingTop:28, borderTop:"1px solid var(--border)", marginTop:8, animation:"fadeUp 0.5s 0.55s ease both", opacity:0 }}>
        <p style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize:15, fontWeight:300, color:"var(--muted)", lineHeight:1.7, marginBottom:24, paddingLeft:14, borderLeft:"2px solid var(--teal-bg)" }}>
          It sounds like… not You are… — this is a mirror, not a prescription.
        </p>
        <button onClick={onNext} style={{ width:"100%", background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.17em", textTransform:"uppercase", padding:"15px 0", cursor:"pointer" }}>
          Start The Mirror
        </button>
      </div>
    </div>
  );
}

function InductionStepScreen({ step, stepIndex, totalSteps, onComplete, existingInsight }) {
  const [msgs,    setMsgs]    = useState([]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(existingInsight || null);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(existingInsight || "");
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading, insight]);
  useEffect(() => { if (msgs.length === 0) open(); }, []);

  async function open() {
    setLoading(true);
    try {
      const reply = await callClaude([{ role:"user", content:"Begin." }], STEP_PROMPTS[step.key], 600);
      const found = extractInsight(reply);
      setMsgs([{ role:"assistant", content:stripInsight(reply) }]);
      if (found && !existingInsight) { setInsight(found); setEditVal(found); }
    } catch { setMsgs([{ role:"assistant", content:"Something went wrong. Please reload and try again." }]); }
    setLoading(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const history = [...msgs, { role:"user", content:text }];
    setMsgs(history); setInput(""); setLoading(true);
    try {
      const reply = await callClaude(history, STEP_PROMPTS[step.key], 600);
      const found = extractInsight(reply);
      setMsgs(prev => [...prev, { role:"assistant", content:stripInsight(reply) }]);
      if (found) { setInsight(found); setEditVal(found); }
    } catch { setMsgs(prev => [...prev, { role:"assistant", content:"Something went wrong. Please try again." }]); }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  const progress = ((stepIndex+1)/totalSteps)*100;
  const isLast   = stepIndex === totalSteps-1;

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", maxWidth:560, margin:"0 auto" }}>
      {/* Sticky header */}
      <div style={{ position:"sticky", top:0, zIndex:20, background:"rgba(248,247,245,0.97)", backdropFilter:"blur(10px)", borderBottom:"1px solid var(--border)", padding:"13px 20px 11px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
          <Logo />
          <span style={{ fontSize:10, color:"var(--muted)", letterSpacing:"0.1em" }}>{stepIndex+1} of {totalSteps}</span>
        </div>
        <div style={{ height:2, background:"var(--border)", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:"var(--teal)", borderRadius:2, transition:"width 0.7s cubic-bezier(0.34,1.56,0.64,1)" }} />
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:7 }}>
          <Cap>{step.num}</Cap>
          <p style={{ fontFamily:"var(--serif)", fontSize:15, fontWeight:400 }}>{step.label}</p>
        </div>
      </div>

      {/* Conversation */}
      <div style={{ flex:1, padding:"24px 20px 12px", display:"flex", flexDirection:"column", gap:20 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ animation:"fadeUp 0.4s ease both", display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start" }}>
            {m.role==="assistant" ? (
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, maxWidth:"90%" }}>
                <div style={{ marginTop:3, flexShrink:0 }}><MirrorMark size={17} color="var(--teal-lt)" /></div>
                <p style={{ fontSize:14, lineHeight:1.85, fontWeight:300, whiteSpace:"pre-wrap" }}>{m.content}</p>
              </div>
            ) : (
              <div style={{ maxWidth:"82%", padding:"10px 14px", background:"white", boxShadow:"var(--shadow)" }}>
                <p style={{ fontSize:14, lineHeight:1.75, fontWeight:300, whiteSpace:"pre-wrap" }}>{m.content}</p>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", alignItems:"center", gap:10, animation:"fadeIn 0.3s ease" }}>
            <MirrorMark size={17} color="var(--teal-lt)" />
            <div style={{ display:"flex", gap:4 }}>
              {[0,1,2].map(j => <div key={j} style={{ width:5, height:5, borderRadius:"50%", background:"var(--teal-lt)", animation:`pulse 1.2s ${j*0.2}s ease infinite` }} />)}
            </div>
          </div>
        )}
        {/* Insight capture card */}
        {insight && !loading && (
          <div style={{ animation:"pop 0.5s ease both", border:"1px solid rgba(29,158,117,0.22)", background:"var(--teal-bg)", padding:"16px 16px", marginTop:4 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--teal)" }} />
              <Cap>Insight captured</Cap>
            </div>
            {editing ? (
              <>
                <textarea autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} rows={3}
                  style={{ width:"100%", fontFamily:"var(--serif)", fontStyle:"italic", fontSize:15, fontWeight:400, lineHeight:1.65, color:"var(--ink)", background:"white", border:"1px solid rgba(29,158,117,0.22)", padding:"12px 14px", resize:"none", outline:"none", boxShadow:"var(--shadow)" }} />
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <button onClick={() => { setInsight(editVal.trim()); setEditing(false); }} style={{ background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:10, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"9px 18px", cursor:"pointer" }}>Save</button>
                  <button onClick={() => setEditing(false)} style={{ background:"none", border:"1.5px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", padding:"9px 16px", cursor:"pointer" }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize:15, fontWeight:400, lineHeight:1.65, color:"var(--ink)", marginBottom:14, paddingBottom:14, borderBottom:"1px solid rgba(29,158,117,0.22)" }}>
                  "{insight}"
                </p>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                  <button onClick={() => onComplete(insight)} style={{ background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:10, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"11px 22px", cursor:"pointer" }}>
                    {isLast ? "Finish The Mirror →" : "Capture & continue →"}
                  </button>
                  <button onClick={() => { setEditVal(insight); setEditing(true); }} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", textDecoration:"underline", textUnderlineOffset:3, cursor:"pointer" }}>
                    Edit this
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <div ref={bottomRef} style={{ paddingBottom:8 }} />
      </div>

      {/* Input */}
      <div style={{ position:"sticky", bottom:0, background:"rgba(248,247,245,0.97)", backdropFilter:"blur(10px)", borderTop:"1px solid var(--border)", padding:"11px 20px 14px" }}>
        <div style={{ display:"flex", gap:9, alignItems:"flex-end" }}>
          <textarea ref={inputRef} value={input} placeholder={insight ? "Refine this further…" : "Take your time. There are no wrong answers…"}
            onChange={e => { setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,100)+"px"; }}
            onKeyDown={e => { if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1} style={{ flex:1, fontFamily:"var(--sans)", fontSize:14, fontWeight:300, color:"var(--ink)", background:"transparent", border:"none", lineHeight:1.65, minHeight:26, maxHeight:100, padding:"3px 0", opacity:insight?0.55:1, resize:"none", outline:"none" }} />
          <button onClick={send} disabled={!input.trim()||loading}
            style={{ width:32, height:32, borderRadius:"50%", border:"none", background:input.trim()&&!loading?"var(--teal)":"var(--border)", color:"white", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s", flexShrink:0, cursor:input.trim()&&!loading?"pointer":"default" }}>
            {loading ? <Spinner size={12} /> : "↑"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InductionSynthesisingScreen() {
  const [si, setSi] = useState(0);
  const stages = ["Reading what you said…","Finding the pattern…","Distilling the signal…","Composing your Brand DNA…"];
  useEffect(() => { const t = setInterval(() => setSi(i => (i+1)%stages.length), 2000); return () => clearInterval(t); }, []);
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28, padding:48 }}>
      <div style={{ animation:"breathe 4s ease-in-out infinite", width:72, height:72, borderRadius:"50%", border:"1.5px solid var(--bstrong)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:46, height:46, borderRadius:"50%", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <MirrorMark size={22} />
        </div>
      </div>
      <p style={{ fontFamily:"var(--serif)", fontSize:19, fontWeight:300, color:"var(--muted)", animation:"pulse 2s ease infinite", textAlign:"center" }}>{stages[si]}</p>
    </div>
  );
}

function InductionDNARevealScreen({ dna, onNext }) {
  const [vis, setVis] = useState(0);
  const lines = (dna||"").split("\n").filter(l=>l.trim());
  const parsed = {};
  for (const ln of lines) { const m=ln.match(/^([A-Z][A-Z\s\/]+):\s*(.+)/); if(m) { const k=m[1].trim().toLowerCase().replace(/[\s\/]+/g,"_"); parsed[k]=m[2].trim(); } }
  if (parsed.brand_tags) parsed.tags = parsed.brand_tags.split(",").map(t=>t.trim()).filter(Boolean);

  const fields = [
    { key:"archetype",       label:"Professional Archetype", hero:true },
    { key:"positioning",     label:"Positioning" },
    { key:"audience",        label:"Audience" },
    { key:"tone",            label:"Tone" },
    { key:"key_message",     label:"Key Message" },
    { key:"style_direction", label:"Style Direction" },
  ];

  useEffect(() => {
    let i=0; const t=setInterval(() => { i++; setVis(i); if(i>=fields.length+2) clearInterval(t); }, 380);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight:"100vh", maxWidth:520, margin:"0 auto", padding:"44px 22px 60px", display:"flex", flexDirection:"column" }}>
      <div style={{ animation:"fadeUp 0.6s ease both", marginBottom:30, display:"flex", alignItems:"flex-start", gap:13 }}>
        <div style={{ marginTop:3 }}><MirrorMark size={26} /></div>
        <div>
          <Cap style={{ marginBottom:7 }}>Brand DNA</Cap>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:30, fontWeight:400, lineHeight:1.08, marginBottom:9 }}>This is you.</h2>
          <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.8, fontWeight:300 }}>Six conversations. One clear picture. Everything you just articulated, distilled.</p>
        </div>
      </div>
      <div style={{ flex:1 }}>
        {fields.map((f,i) => (
          <div key={f.key} style={{ padding:f.hero?"20px 0":"14px 0", borderBottom:"1px solid var(--border)", opacity:vis>i?1:0, transform:vis>i?"none":"translateY(12px)", transition:"opacity 0.5s ease,transform 0.5s ease" }}>
            <Cap style={{ color:"var(--muted)", marginBottom:f.hero?9:6 }}>{f.label}</Cap>
            {f.hero
              ? <p style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:500, color:"var(--teal)", lineHeight:1.2 }}>{parsed[f.key]||"—"}</p>
              : <p style={{ fontFamily:"var(--serif)", fontSize:15, fontWeight:400, lineHeight:1.6 }}>{parsed[f.key]||"—"}</p>}
          </div>
        ))}
      </div>
      {parsed.tags && (
        <div style={{ marginTop:24, opacity:vis>fields.length?1:0, transform:vis>fields.length?"none":"translateY(10px)", transition:"opacity 0.5s ease,transform 0.5s ease" }}>
          <Cap style={{ color:"var(--muted)", marginBottom:10 }}>Brand Tags</Cap>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            {parsed.tags.map((tag,i) => (
              <span key={tag} style={{ fontFamily:"var(--sans)", fontSize:9, fontWeight:400, letterSpacing:"0.15em", textTransform:"uppercase", color:"var(--teal)", border:"1px solid rgba(29,158,117,0.3)", padding:"5px 11px", animation:`fadeUp 0.4s ${i*0.07}s ease both`, opacity:0 }}>{tag}</span>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop:36, opacity:vis>fields.length+1?1:0, transition:"opacity 0.5s ease" }}>
        <button onClick={onNext} style={{ width:"100%", background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.17em", textTransform:"uppercase", padding:"15px 0", cursor:"pointer" }}>
          See what to do next →
        </button>
      </div>
    </div>
  );
}

function InductionNextStepsScreen({ dna, onAction }) {
  function download() {
    if (!dna) return;
    const blob = new Blob([`DFINE — BRAND DNA\n${"═".repeat(36)}\n\n${dna}\n\n${"─".repeat(36)}\nGenerated by Dfine · dfine.app`], { type:"text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download="dfine-brand-dna.txt"; a.click(); URL.revokeObjectURL(url);
  }
  const opts = [
    { l:"A", title:"Build your Presence Blueprint", sub:"Define the gap between how you're read now and how you want to be read. Your roadmap for deliberate professional presence.", action:"Build Blueprint", onClick:() => onAction("blueprint"), primary:true },
    { l:"B", title:"Assess your wardrobe",    sub:"Upload items and see how they read against your Brand DNA.", action:"Open Wardrobe", onClick:() => onAction("wardrobe") },
    { l:"C", title:"Your Brand Dashboard",    sub:"Review and refine your Brand DNA, tone, and positioning.", action:"Open Dashboard", onClick:() => onAction("brand") },
    { l:"D", title:"Download your Brand DNA", sub:"A copy you can reference, share, and build on.", action:"Download", onClick:download },
  ];
  return (
    <div style={{ minHeight:"100vh", maxWidth:500, margin:"0 auto", padding:"48px 22px 48px", display:"flex", flexDirection:"column" }}>
      <div style={{ animation:"fadeUp 0.6s ease both", marginBottom:36 }}>
        <div style={{ width:46, height:46, borderRadius:"50%", border:"1.5px solid var(--teal)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:22 }}><MirrorMark size={20} /></div>
        <Cap style={{ marginBottom:9 }}>You're done</Cap>
        <h2 style={{ fontFamily:"var(--serif)", fontSize:28, fontWeight:400, lineHeight:1.1, marginBottom:12 }}>Your Brand DNA is ready.</h2>
        <p style={{ fontSize:14, color:"var(--muted)", lineHeight:1.8, fontWeight:300 }}>
          You've defined it. Now build the blueprint for how you'll show up with it on purpose.
        </p>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {opts.map((o,i) => (
          <div key={o.l} onClick={o.onClick}
            style={{ padding:"18px 18px", background:o.primary?"var(--teal)":"white", boxShadow:o.primary?"0 4px 24px rgba(29,158,117,0.22)":"var(--shadow)", cursor:"pointer", animation:`fadeUp 0.5s ${0.08+i*0.12}s ease both`, opacity:0, transition:"transform 0.18s,box-shadow 0.18s" }}
            onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=o.primary?"0 6px 32px rgba(29,158,117,0.3)":"var(--shadow-md)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=o.primary?"0 4px 24px rgba(29,158,117,0.22)":"var(--shadow)"; }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:13 }}>
              <span style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:300, color:o.primary?"rgba(255,255,255,0.4)":"var(--teal)", flexShrink:0, paddingTop:1 }}>{o.l}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:"var(--sans)", fontSize:13, fontWeight:500, color:o.primary?"white":"var(--ink)", marginBottom:4 }}>{o.title}</p>
                <p style={{ fontSize:12, fontWeight:300, lineHeight:1.6, color:o.primary?"rgba(255,255,255,0.68)":"var(--muted)" }}>{o.sub}</p>
              </div>
              <span style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:o.primary?"rgba(255,255,255,0.62)":"var(--teal)", flexShrink:0, paddingTop:3, fontFamily:"var(--sans)" }}>{o.action} →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InductionFlow({ onComplete }) {
  const [iScreen, setIScreen] = useState(0);  // 0=process, 1–6=steps, 7=synthesis/reveal, 8=next
  const [insights, setInsights] = useState({});
  const [dna,      setDna]      = useState(null);
  const [synth,    setSynth]    = useState(false);

  const stepIndex   = iScreen >= 1 && iScreen <= 6 ? iScreen - 1 : -1;
  const currentStep = stepIndex >= 0 ? STEPS[stepIndex] : null;

  function advance() { setIScreen(s => s+1); window.scrollTo({ top:0 }); }

  function handleStepDone(key, insight) {
    const updated = { ...insights, [key]: insight };
    setInsights(updated);
    if (stepIndex < STEPS.length-1) { setIScreen(iScreen+1); window.scrollTo({ top:0 }); }
    else synthesise(updated);
  }

  async function synthesise(all) {
    setSynth(true); setIScreen(7); window.scrollTo({ top:0 });
    try {
      const result = await callClaude([{ role:"user", content:"Synthesise my Brand DNA." }], DNA_SYNTHESIS_PROMPT(all), 700);
      setDna(result.trim());
    } catch { setDna("Unable to synthesise at this time. Please try again."); }
    setSynth(false);
  }

  function handleAction(action) {
    onComplete({ insights, dna, action });
  }

  if (iScreen === 0) return <InductionProcessScreen onNext={advance} />;
  if (currentStep)   return <InductionStepScreen key={currentStep.key} step={currentStep} stepIndex={stepIndex} totalSteps={STEPS.length} onComplete={insight => handleStepDone(currentStep.key, insight)} existingInsight={insights[currentStep.key]||null} />;
  if (iScreen === 7 && synth) return <InductionSynthesisingScreen />;
  if (iScreen === 7 && dna)   return <InductionDNARevealScreen dna={dna} onNext={advance} />;
  if (iScreen === 8) return <InductionNextStepsScreen dna={dna} onAction={handleAction} />;
  return null;
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({ setScreen, hasDNA }) {
  const pillars = [
    { n:"01", t:"The Mirror",      d:"A guided conversation that surfaces who you are and who you're projecting. Often not the same thing." },
    { n:"02", t:"Your Wardrobe",   d:"Every item assessed against your brand. Snap an outfit or add items one by one." },
    { n:"03", t:"Dress For…",      d:"Describe the moment. We find the look from what you already own." },
    { n:"04", t:"Change Room",     d:"Considering a purchase? Validate it against your Brand DNA before checkout." },
  ];
  return (
    <div style={{ minHeight:"100vh", paddingTop:56, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"56px 24px 48px" }}>
      <div style={{ textAlign:"center", maxWidth:560, animation:"fadeUp 0.7s ease both" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:40 }}>
          <div style={{ width:70, height:70, borderRadius:"50%", border:"1.5px solid var(--bstrong)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:28, height:28, borderRadius:"50%", border:"1.5px solid var(--teal)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ width:9, height:9, borderRadius:"50%", background:"var(--teal)" }} />
            </div>
          </div>
        </div>
        <h1 style={{ fontFamily:"var(--serif)", fontSize:"clamp(32px,7vw,62px)", fontWeight:400, lineHeight:1.08, marginBottom:22, letterSpacing:"-0.01em" }}>
          What if you were as deliberate about your{" "}
          <em style={{ color:"var(--teal)" }}>professional packaging</em>{" "}
          as Apple is about theirs?
        </h1>
        <p style={{ fontSize:15, lineHeight:1.8, color:"var(--muted)", maxWidth:400, margin:"0 auto 44px", fontWeight:300 }}>
          Dfine makes this simple.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={() => setScreen(hasDNA ? SCREENS.BRAND : SCREENS.INDUCTION)}
            onMouseEnter={e => { e.currentTarget.style.background="var(--teal)"; e.currentTarget.style.borderColor="var(--teal)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="var(--ink)"; e.currentTarget.style.borderColor="var(--ink)"; }}
            style={{ background:"var(--ink)", color:"var(--bg)", border:"1.5px solid var(--ink)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"14px 34px", cursor:"pointer", transition:"all 0.2s" }}>
            {hasDNA ? "Your Mirror" : "Look in the Mirror"}
          </button>
          {hasDNA && (
            <button onClick={() => setScreen(SCREENS.WARDROBE)}
              onMouseEnter={e => { e.currentTarget.style.borderColor="var(--teal)"; e.currentTarget.style.color="var(--teal)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="var(--bstrong)"; e.currentTarget.style.color="var(--ink)"; }}
              style={{ background:"none", color:"var(--ink)", border:"1.5px solid var(--bstrong)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.16em", textTransform:"uppercase", padding:"14px 34px", cursor:"pointer", transition:"all 0.2s" }}>
              Your Wardrobe
            </button>
          )}
          {hasDNA && (
            <button onClick={() => setScreen(SCREENS.CHANGEROOM)}
              onMouseEnter={e => { e.currentTarget.style.borderColor="var(--teal)"; e.currentTarget.style.color="var(--teal)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="var(--bstrong)"; e.currentTarget.style.color="var(--ink)"; }}
              style={{ background:"none", color:"var(--ink)", border:"1.5px solid var(--bstrong)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.16em", textTransform:"uppercase", padding:"14px 34px", cursor:"pointer", transition:"all 0.2s" }}>
              Change Room
            </button>
          )}
        </div>

        {!hasDNA && (
          <p style={{ fontSize:12, color:"var(--muted)", marginTop:20, fontWeight:300, fontStyle:"italic" }}>
            The Mirror is the foundation. The wardrobe, outfit recommendations, and your About unlock once it's complete.
          </p>
        )}
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:20, margin:"52px 0", maxWidth:720, width:"100%" }}>
        <div style={{ flex:1, height:1, background:"var(--border)" }} />
        <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--teal)", opacity:0.5 }} />
        <div style={{ flex:1, height:1, background:"var(--border)" }} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(155px,1fr))", maxWidth:720, width:"100%", boxShadow:"var(--shadow-md)", animation:"fadeUp 0.7s ease 0.18s both" }}>
        {pillars.map((p,i) => (
          <div key={i} style={{ padding:"28px 22px", background:i===0?"var(--teal-bg)":i%2===0?"var(--bg)":"var(--surface)" }}>
            <span style={{ fontFamily:"var(--serif)", fontSize:28, color:i===0?"var(--teal)":"rgba(20,20,18,0.18)", display:"block", marginBottom:14, fontWeight:300 }}>{p.n}</span>
            <h3 style={{ fontFamily:"var(--serif)", fontSize:15, fontWeight:500, marginBottom:8 }}>{p.t}</h3>
            <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.7, fontWeight:300 }}>{p.d}</p>
          </div>
        ))}
      </div>

      {/* Signl bridge */}
      <div style={{ maxWidth:720, width:"100%", marginTop:32, padding:"24px 28px", background:"var(--surface)", border:"1px solid var(--border)", borderLeft:"3px solid var(--teal)", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:20, flexWrap:"wrap", animation:"fadeUp 0.7s ease 0.3s both" }}>
        <div>
          <Cap style={{ marginBottom:8 }}>Not sure where you stand right now?</Cap>
          <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.75, fontWeight:300, maxWidth:400 }}>
            Signl reads the signals you're already sending — from what you wear — before you define anything. A useful starting point if you want to see the gap first.
          </p>
        </div>
        <a href="https://signl.app" target="_blank" rel="noopener noreferrer"
          style={{ display:"inline-flex", alignItems:"center", gap:8, background:"none", color:"var(--teal)", border:"1.5px solid var(--teal)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"12px 22px", cursor:"pointer", textDecoration:"none", whiteSpace:"nowrap", flexShrink:0 }}>
          Try Signl →
        </a>
      </div>
    </div>
  );
}

// ─── STEP CONVERSATION ────────────────────────────────────────────────────────
function StepScreen({ step, messages, setMessages, onComplete, onBack }) {
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [insight, setInsight]           = useState(null);
  const [editableInsight, setEditableInsight] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (messages.length === 0 && !loading) startStep();
  }, []);

  const extractInsight = t => { const m = t.match(/<INSIGHT>([\s\S]*?)<\/INSIGHT>/); return m?m[1].trim():null; };

  const startStep = async () => {
    setLoading(true);
    const opening = [{ role:"user", content:`Let's work on my ${step.label}. Please begin.` }];
    setMessages(opening);
    try {
      const reply = await callClaude(opening, STEP_PROMPTS[step.key]);
      const found = extractInsight(reply);
      const clean = reply.replace(/<INSIGHT>[\s\S]*?<\/INSIGHT>/g,"").trim();
      setMessages([...opening, { role:"assistant", content:clean }]);
      if (found) { setInsight(found); setEditableInsight(found); }
    } catch { setMessages([{ role:"assistant", content:"Something went wrong. Please try again." }]); }
    setLoading(false);
  };

  const send = async text => {
    const updated = [...messages, { role:"user", content:text }];
    setMessages(updated); setInput(""); setLoading(true);
    try {
      const reply = await callClaude(updated, STEP_PROMPTS[step.key]);
      const found = extractInsight(reply);
      const clean = reply.replace(/<INSIGHT>[\s\S]*?<\/INSIGHT>/g,"").trim();
      setMessages([...updated, { role:"assistant", content:clean }]);
      if (found) { setInsight(found); setEditableInsight(found); }
    } catch { setMessages([...updated, { role:"assistant", content:"Something went wrong." }]); }
    setLoading(false);
  };

  return (
    <div style={{ height:"100vh", paddingTop:56, display:"flex", flexDirection:"column", background:"var(--bg)" }}>
      <div style={{ padding:"14px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", padding:"6px 0", display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:14 }}>←</span> Journey
        </button>
        <div style={{ width:1, height:20, background:"var(--border)" }} />
        <div>
          <Cap style={{ marginBottom:2 }}>{step.num}</Cap>
          <p style={{ fontFamily:"var(--serif)", fontSize:18, fontWeight:400 }}>{step.label}</p>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"28px 24px" }}>
        {messages.map((m,i) => (
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", marginBottom:20, animation:"fadeUp 0.4s ease both" }}>
            {m.role==="assistant" && <div style={{ marginRight:10, marginTop:4, flexShrink:0 }}><MirrorMark size={20} /></div>}
            <div style={{ maxWidth:"82%", padding:"14px 18px", background:m.role==="user"?"var(--teal-bg)":"white", fontSize:14, lineHeight:1.85, fontWeight:300, whiteSpace:"pre-wrap", boxShadow:m.role==="assistant"?"var(--shadow)":"none" }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
            <MirrorMark size={20} />
            <Spinner />
            <span style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic" }}>Reflecting…</span>
          </div>
        )}

        {insight && !loading && (
          <div style={{ animation:"pop 0.45s ease both", margin:"8px 0 24px" }}>
            <div style={{ padding:"22px 24px", background:"var(--teal-bg)", borderLeft:"3px solid var(--teal)" }}>
              <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300, marginBottom:14, lineHeight:1.6 }}>Does this land? Edit until it's exactly right.</p>
              <textarea
                value={editableInsight}
                onChange={e => setEditableInsight(e.target.value)}
                rows={3}
                style={{ width:"100%", background:"white", borderLeft:"3px solid var(--teal)", border:"none", color:"var(--ink)", fontFamily:"var(--serif)", fontSize:16, fontWeight:400, fontStyle:"italic", padding:"13px 16px", resize:"none", outline:"none", lineHeight:1.7, boxShadow:"var(--shadow)" }}
              />
            </div>
            <button onClick={() => onComplete(step.key, editableInsight.trim() || insight)} disabled={!editableInsight.trim()} style={{ marginTop:14, width:"100%", background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"14px", cursor:"pointer" }}>
              ✦ This is it — save it
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {!insight && (
        <div style={{ borderTop:"1px solid var(--border)", background:"var(--bg)", padding:"16px 24px 20px", flexShrink:0 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key==="Enter"&&!e.shiftKey&&input.trim()) { e.preventDefault(); send(input.trim()); } }} placeholder="Take your time. There are no wrong answers here…" rows={3} style={{ width:"100%", background:"white", borderLeft:"3px solid var(--teal)", border:"none", color:"var(--ink)", fontFamily:"var(--sans)", fontSize:14, fontWeight:300, padding:"13px 16px", resize:"none", outline:"none", lineHeight:1.7, boxShadow:"var(--shadow)" }} />
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:10 }}>
            <button onClick={() => input.trim()&&send(input.trim())} disabled={loading||!input.trim()} style={{ background:input.trim()&&!loading?"var(--ink)":"transparent", border:`1.5px solid ${input.trim()&&!loading?"var(--ink)":"var(--border)"}`, color:input.trim()&&!loading?"var(--bg)":"var(--muted)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"10px 28px", cursor:input.trim()&&!loading?"pointer":"default", transition:"all 0.18s" }}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BRAND JOURNEY HUB ───────────────────────────────────────────────────────
function BrandScreen({ stepInsights, setStepInsights, stepMessages, setStepMessages, brandDNA, setBrandDNA }) {
  const [activeStep,   setActiveStep]   = useState(null);
  const [synthesising, setSynthesising] = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [editingKey,   setEditingKey]   = useState(null);
  const [editValue,    setEditValue]    = useState("");
  const [importValues, setImportValues] = useState({});

  const completedCount = STEPS.filter(s => stepInsights[s.key]).length;
  const allDone        = completedCount === STEPS.length;

  const handleComplete = (key, insight) => { setStepInsights(prev => ({ ...prev, [key]:insight })); setActiveStep(null); };
  const startEdit      = (key, current) => { setEditingKey(key); setEditValue(current); };
  const saveEdit       = () => { if (editValue.trim()) setStepInsights(prev => ({ ...prev, [editingKey]:editValue.trim() })); setEditingKey(null); setEditValue(""); };

  const handleImport = () => {
    const filled = {};
    STEPS.forEach(s => { if (importValues[s.key]?.trim()) filled[s.key] = importValues[s.key].trim(); });
    if (Object.keys(filled).length > 0) { setStepInsights(prev => ({ ...prev, ...filled })); setShowImport(false); setImportValues({}); }
  };

  const synthesiseDNA = async () => {
    setSynthesising(true);
    try { const reply = await callClaude([{ role:"user", content:"Please synthesise my Brand DNA." }], DNA_SYNTHESIS_PROMPT(stepInsights)); setBrandDNA(reply.trim()); }
    catch { setBrandDNA("Unable to synthesise — please try again."); }
    setSynthesising(false);
  };

  if (activeStep) {
    const step = STEPS.find(s => s.key === activeStep);
    return <StepScreen step={step} messages={stepMessages[activeStep]||[]} setMessages={msgs => setStepMessages(prev=>({...prev,[activeStep]:msgs}))} onComplete={handleComplete} onBack={() => setActiveStep(null)} />;
  }

  if (showImport) {
    return (
      <div style={{ minHeight:"100vh", paddingTop:56, background:"var(--bg)" }}>
        <div style={{ padding:"20px 24px 0", borderBottom:"1px solid var(--border)" }}>
          <div style={{ maxWidth:600, margin:"0 auto", paddingBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><Cap style={{ marginBottom:5 }}>Import</Cap><h2 style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:300 }}>Paste your insights</h2></div>
            <button onClick={() => setShowImport(false)} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer" }}>← Back</button>
          </div>
        </div>
        <div style={{ maxWidth:600, margin:"0 auto", padding:"24px" }}>
          <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.75, fontWeight:300, marginBottom:24 }}>Already have your insights? Paste them directly — each field is optional and will only overwrite steps you fill in.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {STEPS.map((step, i) => (
              <div key={step.key} style={{ animation:`fadeUp 0.4s ease ${i*0.05}s both` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <Cap style={{ marginBottom:0 }}>{step.num} — {step.label}</Cap>
                  {stepInsights[step.key] && <span style={{ fontSize:10, color:"var(--green)", fontWeight:500 }}>✓ Captured</span>}
                </div>
                <textarea value={importValues[step.key]||""} onChange={e => setImportValues(v=>({...v,[step.key]:e.target.value}))}
                  placeholder={stepInsights[step.key]?`Current: "${stepInsights[step.key].substring(0,60)}…"`:`Paste your ${step.label.toLowerCase()} insight…`}
                  rows={3} style={{ width:"100%", background:"white", border:`1.5px solid ${importValues[step.key]?"var(--teal)":"var(--border)"}`, borderLeft:`3px solid ${importValues[step.key]?"var(--teal)":"var(--border)"}`, color:"var(--ink)", fontFamily:"var(--sans)", fontSize:13, fontWeight:300, padding:"12px 16px", resize:"vertical", outline:"none", lineHeight:1.7 }} />
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:24 }}>
            <button onClick={handleImport} style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"13px 28px", cursor:"pointer" }}>Save Insights</button>
            <button onClick={() => setShowImport(false)} style={{ background:"none", color:"var(--muted)", border:"1px solid var(--border)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", padding:"13px 22px", cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", paddingTop:56, background:"var(--bg)" }}>
      <div style={{ padding:"24px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:600, margin:"0 auto", paddingBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1 }}>
              <Cap style={{ marginBottom:8 }}>The Mirror</Cap>
              <h2 style={{ fontFamily:"var(--serif)", fontSize:"clamp(28px,5vw,38px)", fontWeight:300, lineHeight:1.1, marginBottom:10 }}>Your Brand Journey</h2>
              <p style={{ fontSize:13, color:"var(--muted)", fontWeight:300, lineHeight:1.7 }}>Six conversations. Each one surfaces something you already know but haven't yet said.</p>
            </div>
            <button onClick={() => setShowImport(true)} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", padding:"8px 0", cursor:"pointer", flexShrink:0, marginLeft:16, marginTop:4 }}>Import</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"20px 24px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
          {STEPS.map((step, i) => {
            const done       = !!stepInsights[step.key];
            const insight    = stepInsights[step.key];
            const hasStarted = (stepMessages[step.key]||[]).length > 0 && !done;
            const isEditing  = editingKey === step.key;
            // Editorial rhythm: Professional Stance gets more breathing room, Key Message tighter
            const vertPad = step.key === "archetype" ? "26px 22px" : step.key === "message" ? "16px 22px" : "20px 22px";
            return (
              <div key={step.key}>
                {/* Interstitial reflection — after Professional Stance */}
                {i === 3 && completedCount >= 2 && (
                  <div style={{ padding:"18px 22px 14px", animation:`fadeUp 0.5s ease 0.25s both` }}>
                    <p style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic", fontWeight:300, lineHeight:1.8, opacity:0.75 }}>
                      "Professional presence is often shaped by repetition rather than intention."
                    </p>
                  </div>
                )}
                <div style={{ background:done?"white":"white", boxShadow:done?"var(--shadow)":"0 1px 6px rgba(20,20,18,0.04)", borderLeft:`3px solid ${done?"var(--green)":hasStarted?"var(--teal)":"transparent"}`, animation:`fadeUp 0.5s ease ${i*0.06}s both`, marginBottom: step.key === "archetype" ? 6 : 0 }}>
                  {isEditing ? (
                    <div style={{ padding:"20px 22px" }}>
                      <Cap style={{ marginBottom:10 }}>{step.num} — {step.label}</Cap>
                      <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={4} autoFocus
                        style={{ width:"100%", background:"var(--surface)", borderLeft:"3px solid var(--teal)", border:"none", color:"var(--ink)", fontFamily:"var(--sans)", fontSize:13, fontWeight:300, padding:"12px 14px", resize:"vertical", outline:"none", lineHeight:1.75, fontStyle:"italic" }} />
                      <div style={{ display:"flex", gap:8, marginTop:10 }}>
                        <button onClick={saveEdit} style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:10, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"9px 18px", cursor:"pointer" }}>Save</button>
                        <button onClick={() => setEditingKey(null)} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", padding:"9px 0", cursor:"pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setActiveStep(step.key)}
                      style={{ background:"none", border:"none", padding:vertPad, cursor:"pointer", textAlign:"left", display:"block", width:"100%", transition:"box-shadow 0.2s" }}
                      onMouseEnter={e => e.currentTarget.parentElement.style.boxShadow="var(--shadow-md)"}
                      onMouseLeave={e => e.currentTarget.parentElement.style.boxShadow=done?"var(--shadow)":"0 1px 6px rgba(20,20,18,0.04)"}>
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:done?10:6 }}>
                            <div style={{ width:20, height:20, borderRadius:"50%", background:done?"var(--green)":hasStarted?"var(--teal-bg)":"var(--surface)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.3s" }}>
                              {done && <span style={{ color:"white", fontSize:10, fontWeight:600, lineHeight:1 }}>✓</span>}
                            </div>
                            <div>
                              <span style={{ fontSize:10, color:"var(--muted)", fontWeight:300, letterSpacing:"0.1em", marginRight:8 }}>{step.num}</span>
                              <span style={{ fontFamily:"var(--serif)", fontSize:step.key==="archetype"?20:18, fontWeight:done?500:400 }}>{step.label}</span>
                            </div>
                          </div>
                          {done && insight ? (
                            <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.65, fontStyle:"italic", fontWeight:300, paddingLeft:30 }}>"{insight}"</p>
                          ) : (
                            <>
                              <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300, paddingLeft:30 }}>{step.sub}</p>
                              {step.key !== "message" && <p style={{ fontSize:12, color:"var(--ink)", fontWeight:300, paddingLeft:30, marginTop:8, lineHeight:1.7, fontStyle:"italic", opacity:0.7 }}>{step.benefit}</p>}
                            </>
                          )}
                          {hasStarted && <p style={{ fontSize:11, color:"var(--teal)", paddingLeft:30, marginTop:6, fontWeight:400 }}>In progress</p>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0, marginTop:2 }}>
                          {done && <span onClick={e => { e.stopPropagation(); startEdit(step.key, insight); }} style={{ fontSize:10, color:"var(--muted)", cursor:"pointer", fontFamily:"var(--sans)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:300 }}>edit</span>}
                          <span style={{ fontSize:16, color:done?"var(--green)":"rgba(20,20,18,0.25)" }}>→</span>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {allDone && !brandDNA && (
          <div style={{ marginTop:32, animation:"pop 0.5s ease both" }}>
            <div style={{ padding:"1px", background:"linear-gradient(135deg, var(--teal), #0F6E56)" }}>
              <button onClick={synthesiseDNA} disabled={synthesising}
                style={{ width:"100%", background:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:12, fontWeight:500, letterSpacing:"0.18em", textTransform:"uppercase", padding:"18px", cursor:synthesising?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:12, color:"var(--ink)" }}
                onMouseEnter={e => { if(!synthesising) e.currentTarget.style.background="var(--surface)"; }}
                onMouseLeave={e => e.currentTarget.style.background="var(--bg)"}>
                {synthesising ? <><Spinner size={14} /><span>Synthesising your Brand DNA…</span></> : "✦ Generate My Brand DNA"}
              </button>
            </div>
          </div>
        )}

        {brandDNA && (
          <div style={{ marginTop:28, padding:"28px 26px", background:"white", borderTop:"3px solid var(--teal)", animation:"pop 0.5s ease both", boxShadow:"var(--shadow-md)" }}>
            <Cap style={{ marginBottom:14 }}>Your Brand DNA</Cap>
            <pre style={{ fontFamily:"var(--sans)", fontSize:13, lineHeight:1.9, whiteSpace:"pre-wrap", color:"var(--ink)", fontWeight:300 }}>{brandDNA}</pre>
            <button onClick={() => setBrandDNA("")} style={{ marginTop:20, background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer" }}>Regenerate</button>
          </div>
        )}

        {completedCount === 0 && (
          <div style={{ textAlign:"center", paddingTop:20, animation:"fadeUp 0.5s ease 0.4s both" }}>
            <p style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", fontWeight:300 }}>Start with whichever dimension feels most alive right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── WARDROBE ─────────────────────────────────────────────────────────────────
function WardrobeScreen({ wardrobe, setWardrobe, brandDNA }) {
  // wardrobeView: "grid" | "snap" | "item"
  const [wardrobeView, setWardrobeView] = useState(wardrobe.length === 0 ? "snap" : "grid");
  const [selected, setSelected]         = useState(null);

  // Shared image state
  const [preview, setPreview]   = useState(null);
  const [base64, setBase64]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Single item state
  const [itemName, setItemName]       = useState("");
  const [category, setCategory]       = useState("Tops");
  const [savedResult, setSavedResult] = useState(null);

  // Snap outfit state
  const [snapResult, setSnapResult]   = useState(null);

  // File input refs — avoids capture="environment" which blocks file picker in non-mobile environments
  const snapFileRef = useRef(null);
  const itemFileRef = useRef(null);

  const compressAndSet = (file) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      URL.revokeObjectURL(url);
      setPreview(dataUrl);
      setBase64(dataUrl.split(",")[1]);
      setSavedResult(null);
      setSnapResult(null);
    };
    img.src = url;
  };

  const resetForm = () => { setPreview(null); setBase64(null); setItemName(""); setCategory("Tops"); setSavedResult(null); setSnapResult(null); };

  // ── Snap outfit flow ──
  const analyseOutfit = async () => {
    if (!base64) return;
    setLoading(true);
    try {
      const reply  = await callClaude([{ role:"user", content:"Analyse this complete outfit." }], buildOutfitSnapSystem(brandDNA), base64, 1400);
      const parsed = parseJSON(reply);
      if (!parsed) throw new Error("parse fail");
      setSnapResult(parsed);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const saveOutfitItems = () => {
    if (!snapResult?.items?.length) return;
    const newItems = snapResult.items.map((item, i) => ({
      id:          `${Date.now()}-${i}`,
      name:        item.description?.split(",")[0] || item.category,
      category:    item.category || inferCategory(item.description),
      preview,
      description: item.description,
      verdict:     item.read || null,
      brandTags:   item.brandTags || [],
      assessment:  item.assessment || null,
      signals:     snapResult.signals || null,
      fromSnap:    true,
    }));
    setWardrobe(prev => {
      const existing = new Set(prev.map(x => x.name.toLowerCase()));
      return [...prev, ...newItems.filter(x => !existing.has(x.name.toLowerCase()))];
    });
    resetForm();
    setWardrobeView("grid");
  };

  // ── Single item flow ──
  const assessAndSave = async () => {
    if (!base64) return;
    setLoading(true);
    try {
      const reply  = await callClaude([{ role:"user", content:"Reflect on this clothing item." }], buildWardrobeSystem(brandDNA), base64);
      const parsed = parseJSON(reply);
      const item   = { id:Date.now().toString(), name:itemName.trim()||parsed?.itemDescription?.split(",")[0]||category, category, preview, description:parsed?.itemDescription||itemName.trim()||category, verdict:parsed?.read||null, brandTags:parsed?.brandTags||[], assessment:parsed?.assessment||null };
      setWardrobe(w => [...w, item]);
      setSavedResult({ ...parsed, verdict: parsed?.read || null, itemName:item.name });
      setPreview(null); setBase64(null); setItemName("");
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const removeItem = id => { setWardrobe(w => w.filter(i => i.id!==id)); setSelected(null); };

  const assessed   = wardrobe.filter(i => i.verdict);
  const onBrand    = assessed.filter(i => i.verdict?.includes("Strongly")).length;
  const caveats    = assessed.filter(i => i.verdict?.includes("Caveats")).length;
  const misaligned = assessed.filter(i => i.verdict?.includes("Misalignment")).length;

  const goBack = () => { resetForm(); setWardrobeView(wardrobe.length > 0 ? "grid" : "snap"); };

  return (
    <div style={{ minHeight:"100vh", paddingTop:56 }}>
      {/* ── Header ── */}
      <div style={{ padding:"16px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:960, margin:"0 auto", paddingBottom:14, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <Cap style={{ marginBottom:5 }}>Wardrobe</Cap>
            <h2 style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:300 }}>
              {wardrobeView==="grid" ? (wardrobe.length>0 ? `${wardrobe.length} item${wardrobe.length!==1?"s":""}` : "Your collection") : wardrobeView==="snap" ? "Snap an Outfit" : "Add an Item"}
            </h2>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {wardrobeView !== "grid" ? (
              <button onClick={goBack} style={{ background:"none", color:"var(--muted)", border:"1.5px solid var(--border)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.14em", textTransform:"uppercase", padding:"10px 18px", cursor:"pointer" }}>
                ← Back
              </button>
            ) : (
              <>
                <button onClick={() => { resetForm(); setWardrobeView("snap"); }} style={{ background:"var(--ink)", color:"var(--bg)", border:"1.5px solid var(--ink)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"10px 18px", cursor:"pointer", transition:"all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background="var(--teal)"; e.currentTarget.style.borderColor="var(--teal)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="var(--ink)"; e.currentTarget.style.borderColor="var(--ink)"; }}
                >
                  Snap Outfit
                </button>
                <button onClick={() => { resetForm(); setWardrobeView("item"); }} style={{ background:"none", color:"var(--ink)", border:"1.5px solid var(--bstrong)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.14em", textTransform:"uppercase", padding:"10px 18px", cursor:"pointer" }}>
                  + Add Item
                </button>
              </>
            )}
          </div>
        </div>

        {wardrobeView==="grid" && wardrobe.length>0 && assessed.length>0 && (
          <div style={{ maxWidth:960, margin:"0 auto", paddingBottom:12, display:"flex", alignItems:"center", gap:20, flexWrap:"wrap", justifyContent:"flex-end" }}>
            <div style={{ display:"flex", gap:18 }}>
              {onBrand>0    && <span style={{ fontSize:11, color:"var(--green)", fontWeight:400 }}>✦ {onBrand} on brand</span>}
              {caveats>0    && <span style={{ fontSize:11, color:"var(--teal)", fontWeight:400 }}>◈ {caveats} with caveats</span>}
              {misaligned>0 && <span style={{ fontSize:11, color:"var(--red)", fontWeight:400 }}>✕ {misaligned} misaligned</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── SNAP OUTFIT MODE ── */}
      {wardrobeView === "snap" && (
        <div style={{ maxWidth:760, margin:"0 auto", padding:"32px 24px" }}>
          {snapResult ? (
            // Snap result display
            <div style={{ animation:"slideUp 0.4s ease both" }}>
              {/* Outfit overview */}
              <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", boxShadow:"var(--shadow)", borderTop:`3px solid ${verdictColor(snapResult.outfitSignal)}`, background:"white", overflow:"hidden", marginBottom:12 }}>
                <div style={{ borderRight:"1px solid var(--border)" }}>
                  <img src={preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", minHeight:220, display:"block" }} />
                </div>
                <div style={{ padding:"22px 24px" }}>
                  <Cap style={{ marginBottom:10 }}>Outfit Reading</Cap>
                  <p style={{ fontFamily:"var(--serif)", fontSize:15, lineHeight:1.85, fontWeight:300, fontStyle:"italic", marginBottom:14 }}>{snapResult.outfitRead}</p>
                  {snapResult.outfitSignal && (
                    <span style={{ fontSize:11, color:verdictColor(snapResult.outfitSignal), fontWeight:500, display:"block", marginBottom:12 }}>{snapResult.outfitSignal}</span>
                  )}
                  {snapResult.signalTags?.length>0 && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {snapResult.signalTags.map((t,i) => (
                        <span key={i} style={{ fontSize:10, color:"var(--teal)", border:"1px solid rgba(29,158,117,0.25)", padding:"3px 10px", letterSpacing:"0.1em", fontWeight:500 }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Signal radar */}
              {snapResult.signals && (
                <div style={{ marginBottom:12 }}>
                  <SignalRadar signals={snapResult.signals} />
                </div>
              )}

              {/* Detected items */}
              {snapResult.items?.length>0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ padding:"10px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <Cap style={{ color:"var(--muted)" }}>{snapResult.items.length} item{snapResult.items.length!==1?"s":""} detected</Cap>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    {snapResult.items.map((item,i) => (
                      <div key={i} style={{ padding:"14px 18px", background:"white", boxShadow:"0 1px 4px rgba(20,20,18,0.04)", borderLeft:`3px solid ${verdictColor(item.read)}`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, animation:`fadeUp 0.4s ease ${i*0.06}s both` }}>
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:13, fontWeight:400, marginBottom:4 }}>{item.description}</p>
                          <p style={{ fontSize:11, color:"var(--muted)", fontWeight:300 }}>{item.category}</p>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                          {item.read && <span style={{ fontSize:10, color:verdictColor(item.read), fontWeight:500, whiteSpace:"nowrap" }}>{item.read}</span>}
                          {item.brandTags?.length>0 && (
                            <div style={{ display:"flex", gap:4 }}>
                              {item.brandTags.slice(0,2).map((t,j) => <span key={j} style={{ fontSize:9, color:"var(--teal)", border:"1px solid rgba(29,158,117,0.2)", padding:"1px 7px", letterSpacing:"0.08em" }}>{t}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:10 }}>
                <button onClick={saveOutfitItems} style={{ flex:1, background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"14px", cursor:"pointer" }}>
                  ✦ Save {snapResult.items?.length||0} Items to Wardrobe
                </button>
                <button onClick={resetForm} style={{ background:"none", border:"1px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", padding:"14px 20px", cursor:"pointer" }}>
                  Discard
                </button>
              </div>
            </div>
          ) : (
            // Snap upload
            <div style={{ animation:"fadeUp 0.4s ease both" }}>
              <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.8, fontWeight:300, marginBottom:24, maxWidth:480 }}>
                Photograph your complete outfit. Every visible item will be detected, assessed against your Brand DNA, and added to your wardrobe automatically.
              </p>

              {/* Hidden file input — no capture attribute so file picker works everywhere */}
              <input ref={snapFileRef} type="file" accept="image/*"
                style={{ display:"none" }}
                onChange={e => { if (!preview && e.target.files[0]) compressAndSet(e.target.files[0]); e.target.value=""; }} />

              {/* Upload zone — click or drag-and-drop */}
              <div
                onClick={() => !preview && snapFileRef.current?.click()}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (!preview && e.dataTransfer.files[0]) compressAndSet(e.dataTransfer.files[0]); }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                style={{ border:`1.5px dashed ${dragOver?"var(--teal)":preview?"var(--teal)":"var(--bstrong)"}`, minHeight:320, display:"flex", alignItems:"center", justifyContent:"center", background:dragOver?"var(--teal-bg)":"white", overflow:"hidden", transition:"border-color 0.2s, background 0.2s", position:"relative", marginBottom:16, cursor:preview?"default":"pointer" }}>
                {preview ? (
                  <>
                    <img src={preview} alt="" style={{ width:"100%", maxHeight:440, objectFit:"contain" }} />
                    {loading && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(248,247,245,0.88)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
                        <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
                          <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg, transparent, var(--teal), transparent)", opacity:0.6, animation:"scanline 1.8s linear infinite" }} />
                        </div>
                        <Spinner size={20} />
                        <p style={{ fontSize:11, letterSpacing:"0.18em", textTransform:"uppercase", color:"var(--teal)", fontWeight:400 }}>Reading your outfit…</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign:"center", padding:40 }}>
                    <div style={{ width:60, height:60, borderRadius:"50%", border:"1.5px solid var(--bstrong)", margin:"0 auto 20px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", border:"1.5px solid var(--teal-lt)" }} />
                    </div>
                    <p style={{ fontFamily:"var(--serif)", fontSize:20, marginBottom:8, fontWeight:300 }}>Click or drop a photo here</p>
                    <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300, lineHeight:1.7 }}>Opens your file picker or camera.<br />Full outfit gives the sharpest read.</p>
                  </div>
                )}
              </div>

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                {preview && <button onClick={e => { e.preventDefault(); resetForm(); }} style={{ background:"none", border:"none", color:"var(--muted)", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--sans)" }}>✕ Remove</button>}
                <div style={{ marginLeft:"auto" }}>
                  <button onClick={analyseOutfit} disabled={!base64||loading}
                    style={{ background:base64&&!loading?"var(--ink)":"transparent", border:`1.5px solid ${base64&&!loading?"var(--ink)":"var(--border)"}`, color:base64&&!loading?"var(--bg)":"var(--muted)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"13px 32px", cursor:base64&&!loading?"pointer":"default", display:"flex", alignItems:"center", gap:10, transition:"all 0.18s" }}>
                    {loading ? <><Spinner size={13} /><span>Reading signals…</span></> : "Read My Outfit"}
                  </button>
                </div>
              </div>

              {brandDNA && (
                <div style={{ marginTop:20, padding:"12px 16px", background:"var(--teal-bg)", borderLeft:"3px solid var(--teal)" }}>
                  <Cap style={{ marginBottom:4, fontSize:9 }}>Brand DNA Active</Cap>
                  <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.6, fontWeight:300 }}>Each detected item will be assessed against your professional stance, tone, and positioning.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ADD SINGLE ITEM MODE ── */}
      {wardrobeView === "item" && (
        <div style={{ maxWidth:760, margin:"0 auto", padding:"32px 24px" }}>
          {savedResult ? (
            <div style={{ animation:"slideUp 0.4s ease both" }}>
              <div style={{ padding:"26px", background:"white", boxShadow:"var(--shadow)", borderTop:`3px solid ${savedResult.quick?"var(--border)":verdictColor(savedResult.verdict)}`, marginBottom:18 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                  <div><Cap style={{ marginBottom:8, color:"var(--green)" }}>Saved</Cap><p style={{ fontFamily:"var(--serif)", fontSize:22, fontWeight:300 }}>{savedResult.itemName}</p></div>
                  {savedResult.verdict && <span style={{ fontSize:11, color:verdictColor(savedResult.verdict), border:`1px solid ${verdictColor(savedResult.verdict)}`, padding:"5px 12px", whiteSpace:"nowrap" }}>{savedResult.verdict}</span>}
                </div>
                {savedResult.brandTags?.length>0 && <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:18 }}>{savedResult.brandTags.map((t,i) => <span key={i} style={{ fontSize:10, color:"var(--teal)", border:"1px solid rgba(29,158,117,0.25)", padding:"3px 10px", letterSpacing:"0.1em", fontWeight:500 }}>{t}</span>)}</div>}
                {savedResult.assessment && <AssessmentText text={savedResult.assessment} />}
                {savedResult.quick && <p style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", marginTop:12, fontWeight:300 }}>No reflection yet. Complete The Mirror for brand-aligned analysis.</p>}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={resetForm} style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"12px 22px", cursor:"pointer" }}>Add Another</button>
                <button onClick={() => { setWardrobeView("grid"); setSavedResult(null); }} style={{ background:"none", color:"var(--muted)", border:"1px solid var(--border)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", padding:"12px 22px", cursor:"pointer" }}>View Wardrobe</button>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:24, animation:"fadeUp 0.4s ease both" }}>
              {/* Photo area — ref-triggered, drag-and-drop enabled */}
              <input ref={itemFileRef} type="file" accept="image/*"
                style={{ display:"none" }}
                onChange={e => { if (!preview && e.target.files[0]) compressAndSet(e.target.files[0]); e.target.value=""; }} />
              <div
                onClick={() => !preview && itemFileRef.current?.click()}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (!preview && e.dataTransfer.files[0]) compressAndSet(e.dataTransfer.files[0]); }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                style={{ border:`1.5px dashed ${dragOver?"var(--teal)":preview?"var(--teal)":"var(--bstrong)"}`, minHeight:220, display:"flex", alignItems:"center", justifyContent:"center", background:dragOver?"var(--teal-bg)":"white", overflow:"hidden", transition:"border-color 0.2s, background 0.2s", cursor:preview?"default":"pointer" }}>
                {preview ? <img src={preview} alt="" style={{ width:"100%", maxHeight:320, objectFit:"contain" }} /> :
                  <div style={{ textAlign:"center", padding:32 }}>
                    <div style={{ width:50, height:50, borderRadius:"50%", border:"1.5px solid var(--bstrong)", margin:"0 auto 18px", display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:18, height:18, borderRadius:"50%", border:"1.5px solid var(--teal-lt)" }} /></div>
                    <p style={{ fontFamily:"var(--serif)", fontSize:17, marginBottom:6 }}>Click or drop a photo here</p>
                    <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300 }}>Optional — you can save without one</p>
                  </div>
                }
              </div>
              {preview && <button onClick={e => { e.preventDefault(); setPreview(null); setBase64(null); }} style={{ background:"none", border:"none", color:"var(--muted)", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--sans)", alignSelf:"flex-start" }}>✕ Remove photo</button>}

              {/* Name and category */}
              <div>
                <Cap style={{ marginBottom:10 }}>Name this item</Cap>
                <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. Navy wool blazer" style={{ width:"100%", background:"white", border:"1.5px solid var(--border)", color:"var(--ink)", fontFamily:"var(--sans)", fontSize:14, fontWeight:300, padding:"12px 16px", outline:"none" }} />
              </div>
              <div>
                <Cap style={{ marginBottom:12 }}>Category</Cap>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)} style={{ background:category===cat?"var(--teal-bg)":"white", border:`1.5px solid ${category===cat?"var(--teal)":"var(--border)"}`, color:category===cat?"var(--teal)":"var(--muted)", fontFamily:"var(--sans)", fontSize:11, fontWeight:category===cat?500:300, letterSpacing:"0.08em", padding:"6px 12px", cursor:"pointer", transition:"all 0.15s" }}>{cat}</button>
                  ))}
                </div>
              </div>

              {brandDNA && <div style={{ padding:"12px 16px", background:"var(--teal-bg)", borderLeft:"3px solid var(--teal)" }}><Cap style={{ marginBottom:4, fontSize:9 }}>Brand DNA Active</Cap><p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.6, fontWeight:300 }}>Assessment references your professional stance, tone, and positioning.</p></div>}

              {/* Save buttons */}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {!brandDNA && <p style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic", lineHeight:1.6, fontWeight:300 }}>Complete The Mirror for brand-aligned reflection.</p>}
                <button onClick={assessAndSave} disabled={!base64||loading||(!itemName.trim()&&!base64)}
                  style={{ width:"100%", background:base64&&!loading?"var(--ink)":"transparent", border:`1.5px solid ${base64&&!loading?"var(--ink)":"var(--border)"}`, color:base64&&!loading?"var(--bg)":"var(--muted)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"14px", cursor:base64&&!loading?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                  {loading?<><Spinner size={13} /><span>Reflecting…</span></>:"Reflect & Save"}
                </button>
                <button onClick={() => {
                  const nameToUse = itemName.trim() || `${category} item`;
                  const item = { id:Date.now().toString(), name:nameToUse, category, preview:preview||null, description:nameToUse, verdict:null, brandTags:[], assessment:null };
                  setWardrobe(w => [...w, item]);
                  setSavedResult({ quick:true, itemName:item.name });
                  setPreview(null); setBase64(null); setItemName("");
                }} disabled={!itemName.trim()&&!base64}
                  style={{ width:"100%", background:"none", border:"1.5px solid var(--border)", color:(itemName.trim()||base64)?"var(--muted)":"rgba(118,116,112,0.3)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", padding:"12px", cursor:(itemName.trim()||base64)?"pointer":"default" }}>
                  Save Without Reflection
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GRID ── */}
      {wardrobeView === "grid" && (
        <div style={{ maxWidth:960, margin:"0 auto", padding:"20px 24px" }}>
          {wardrobe.length===0 ? (
            <div style={{ textAlign:"center", paddingTop:90, animation:"fadeUp 0.5s ease both" }}>
              <div style={{ width:58, height:58, borderRadius:"50%", border:"1.5px solid var(--bstrong)", margin:"0 auto 22px", display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:20, height:20, borderRadius:"50%", border:"1.5px solid var(--teal-lt)" }} /></div>
              <p style={{ fontFamily:"var(--serif)", fontSize:20, marginBottom:10, fontWeight:300 }}>Nothing here yet</p>
              <p style={{ color:"var(--muted)", fontSize:13, marginBottom:28, fontWeight:300 }}>Snap an outfit or add items one by one.</p>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={() => setWardrobeView("snap")} style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"13px 28px", cursor:"pointer" }}>Snap an Outfit</button>
                <button onClick={() => setWardrobeView("item")} style={{ background:"none", color:"var(--ink)", border:"1.5px solid var(--bstrong)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.16em", textTransform:"uppercase", padding:"13px 28px", cursor:"pointer" }}>+ Add Item</button>
              </div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(148px,1fr))", gap:2 }}>
              {wardrobe.map(item => (
                <div key={item.id} onClick={() => setSelected(item)}
                  onMouseEnter={e => e.currentTarget.style.boxShadow="var(--shadow-md)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow="var(--shadow)"}
                  style={{ cursor:"pointer", background:"white", boxShadow:"var(--shadow)", overflow:"hidden", transition:"box-shadow 0.2s" }}>
                  <div style={{ aspectRatio:"3/4", overflow:"hidden", position:"relative" }}>
                    <img src={item.preview} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    {item.verdict && <div style={{ position:"absolute", top:8, right:8, width:8, height:8, borderRadius:"50%", background:verdictColor(item.verdict) }} />}
                    {item.fromSnap && <div style={{ position:"absolute", bottom:8, left:8, fontSize:8, letterSpacing:"0.1em", textTransform:"uppercase", background:"rgba(20,20,18,0.6)", color:"white", padding:"2px 6px" }}>Outfit Snap</div>}
                  </div>
                  <div style={{ padding:"12px 14px", borderTop:`2px solid ${verdictColor(item.verdict)}` }}>
                    <p style={{ fontSize:12, fontWeight:500, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</p>
                    <p style={{ fontSize:11, color:"var(--muted)", fontWeight:300, marginBottom:item.brandTags?.length?6:0 }}>{item.category}</p>
                    {item.brandTags?.length>0 && <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>{item.brandTags.slice(0,2).map((t,i) => <span key={i} style={{ fontSize:9, color:"var(--teal)", border:"1px solid rgba(29,158,117,0.2)", padding:"1px 6px", letterSpacing:"0.06em", fontWeight:500 }}>{t}</span>)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ITEM MODAL ── */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position:"fixed", inset:0, background:"rgba(20,20,18,0.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24, animation:"fadeIn 0.2s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"var(--bg)", boxShadow:"var(--shadow-md)", maxWidth:640, width:"100%", maxHeight:"88vh", overflow:"auto", animation:"slideUp 0.25s ease both" }}>
            <div style={{ display:"grid", gridTemplateColumns:"185px 1fr" }}>
              <div style={{ borderBottom:`3px solid ${verdictColor(selected.verdict)}` }}>
                <img src={selected.preview} alt={selected.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", minHeight:220 }} />
              </div>
              <div style={{ padding:24, display:"flex", flexDirection:"column" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <Cap>{selected.category}{selected.fromSnap?" · Outfit Snap":""}</Cap>
                  <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:16 }}>✕</button>
                </div>
                <h3 style={{ fontFamily:"var(--serif)", fontSize:22, fontWeight:300, marginBottom:8 }}>{selected.name}</h3>
                {selected.verdict && <span style={{ fontSize:11, color:verdictColor(selected.verdict), marginBottom:10, display:"inline-block", fontWeight:500 }}>{selected.verdict}</span>}
                {selected.brandTags?.length>0 && <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>{selected.brandTags.map((t,i) => <span key={i} style={{ fontSize:10, color:"var(--teal)", border:"1px solid rgba(29,158,117,0.25)", padding:"3px 10px", letterSpacing:"0.1em", fontWeight:500 }}>{t}</span>)}</div>}
                {selected.description && <p style={{ fontSize:13, color:"var(--muted)", marginBottom:14, fontStyle:"italic", lineHeight:1.6, fontWeight:300 }}>{selected.description}</p>}
                {selected.signals && (
                  <div style={{ marginBottom:14 }}>
                    <SignalRadar signals={selected.signals} compact />
                  </div>
                )}
                {selected.assessment ? <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}><AssessmentText text={selected.assessment} /></div> : <p style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", fontWeight:300 }}>No reflection recorded.</p>}
                <button onClick={() => removeItem(selected.id)} style={{ marginTop:22, background:"none", border:"1px solid rgba(160,53,53,0.2)", color:"var(--red)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", padding:"10px", cursor:"pointer" }}
                  onMouseEnter={e => e.target.style.borderColor="var(--red)"}
                  onMouseLeave={e => e.target.style.borderColor="rgba(160,53,53,0.2)"}>
                  Remove from Wardrobe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SIGNATURE ────────────────────────────────────────────────────────────────
function SignatureScreen({ brandDNA, signature, setSignature, setScreen }) {
  const [loading, setLoading] = useState({ linkedin:false, pitch:false });
  const [copied,  setCopied]  = useState({ linkedin:false, pitch:false });

  const generate = async (type) => {
    if (!brandDNA) return;
    setLoading(l => ({ ...l, [type]:true }));
    try {
      const system = type === "linkedin" ? buildLinkedInSystem(brandDNA) : buildElevatorPitchSystem(brandDNA);
      const reply  = await callClaude([{ role:"user", content:"Please write this for me." }], system);
      setSignature(s => ({ ...s, [type]:reply.trim() }));
    } catch(e) { console.error(e); }
    setLoading(l => ({ ...l, [type]:false }));
  };

  const copy = async (type) => {
    await navigator.clipboard.writeText(signature[type] || "");
    setCopied(c => ({ ...c, [type]:true }));
    setTimeout(() => setCopied(c => ({ ...c, [type]:false })), 2000);
  };

  const outputs = [
    {
      key:      "linkedin",
      num:      "01",
      label:    "LinkedIn Summary",
      sub:      "First person · Your voice · Ready to paste",
      why:      "Most LinkedIn summaries sound like everyone else because they're written without a clear positioning or tone. This one is written from yours.",
      empty:    "Your LinkedIn summary will appear here — written in your voice, from your positioning.",
      action:   "Generate LinkedIn Summary",
    },
    {
      key:      "pitch",
      num:      "02",
      label:    "Elevator Pitch",
      sub:      "Spoken register · ~60 seconds · Your words",
      why:      "An elevator pitch fails when it tries to cover everything. This one is built around your key message and professional stance — the two things that actually land.",
      empty:    "Your elevator pitch will appear here — conversational, confident, completely yours.",
      action:   "Generate Elevator Pitch",
    },
  ];

  return (
    <div style={{ minHeight:"100vh", paddingTop:56 }}>
      <div style={{ padding:"16px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:720, margin:"0 auto", paddingBottom:16 }}>
          <Cap style={{ marginBottom:5 }}>Signature</Cap>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:300 }}>Your words. Your voice.</h2>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"32px 24px", display:"flex", flexDirection:"column", gap:16 }}>

        {!brandDNA ? (
          <div style={{ textAlign:"center", paddingTop:80, animation:"fadeUp 0.5s ease both" }}>
            <div style={{ width:58, height:58, borderRadius:"50%", border:"1.5px solid var(--bstrong)", margin:"0 auto 22px", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ width:20, height:20, borderRadius:"50%", border:"1.5px solid var(--teal-lt)" }} />
            </div>
            <p style={{ fontFamily:"var(--serif)", fontSize:20, marginBottom:10, fontWeight:300 }}>Your Brand DNA isn&#39;t ready yet</p>
            <p style={{ color:"var(--muted)", fontSize:13, margin:"0 auto 28px", maxWidth:360, fontWeight:300, lineHeight:1.75 }}>
              Complete The Mirror first. Once your Brand DNA is synthesised, your LinkedIn summary and elevator pitch write themselves from it.
            </p>
            <button onClick={() => setScreen(SCREENS.BRAND)} style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"13px 28px", cursor:"pointer" }}>
              Go to The Mirror →
            </button>
          </div>
        ) : (
          outputs.map((o, i) => (
            <div key={o.key} style={{ background:"white", boxShadow:"var(--shadow)", borderTop:`2px solid var(--teal)`, animation:`fadeUp 0.4s ease ${i*0.08}s both` }}>
              {/* Header */}
              <div style={{ padding:"22px 26px", paddingBottom:"18px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                    <span style={{ fontSize:10, color:"var(--teal)", letterSpacing:"0.18em", textTransform:"uppercase", fontWeight:600 }}>{o.num}</span>
                    <div style={{ flex:1, height:1, background:"var(--border)" }} />
                  </div>
                  <h3 style={{ fontFamily:"var(--serif)", fontSize:22, fontWeight:300, marginBottom:4 }}>{o.label}</h3>
                  <p style={{ fontSize:11, color:"var(--muted)", letterSpacing:"0.08em", fontWeight:300 }}>{o.sub}</p>
                </div>
                {signature[o.key] && (
                  <button onClick={() => generate(o.key)} disabled={loading[o.key]} style={{ background:"none", border:"1px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", padding:"7px 14px", cursor:"pointer", flexShrink:0 }}>
                    Regenerate
                  </button>
                )}
              </div>

              {/* Why this matters */}
              <div style={{ padding:"14px 26px 18px", background:"var(--teal-bg)", borderLeft:"3px solid var(--teal)" }}>
                <p style={{ fontSize:12, color:"var(--ink)", lineHeight:1.75, fontWeight:300, fontStyle:"italic" }}>{o.why}</p>
              </div>

              {/* Content area */}
              <div style={{ padding:"24px 26px" }}>
                {loading[o.key] ? (
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 0" }}>
                    <Spinner size={14} />
                    <span style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic" }}>Writing in your voice…</span>
                  </div>
                ) : signature[o.key] ? (
                  <div style={{ animation:"fadeUp 0.4s ease both" }}>
                    <pre style={{ fontFamily:"var(--sans)", fontSize:14, lineHeight:1.9, whiteSpace:"pre-wrap", color:"var(--ink)", fontWeight:300, marginBottom:20 }}>{signature[o.key]}</pre>
                    <button onClick={() => copy(o.key)} style={{ background:copied[o.key]?"var(--green)":"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.14em", textTransform:"uppercase", padding:"11px 24px", cursor:"pointer", transition:"background 0.2s" }}>
                      {copied[o.key] ? "✓ Copied" : "Copy to Clipboard"}
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign:"center", padding:"32px 0" }}>
                    <p style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", fontWeight:300, marginBottom:22, maxWidth:400, margin:"0 auto 22px" }}>{o.empty}</p>
                    <button onClick={() => generate(o.key)} style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"13px 28px", cursor:"pointer" }}>
                      {o.action}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── DRESS FOR SUCCESS ────────────────────────────────────────────────────────
function DressScreen({ wardrobe, brandDNA, setScreen }) {
  const [mode, setMode]           = useState("choose");   // "choose" | "calendar" | "manual"
  const [event, setEvent]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState("");
  const [calEvents, setCalEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // ── Occasion context tags — inferred from calendar title ──
  const inferContext = (title = "") => {
    const t = title.toLowerCase();
    if (/board|investor|exec|ceo|cfo|coo|partner|vc|fund|pitch deck/.test(t))   return { label:"High Stakes", color:"var(--red)" };
    if (/client|customer|prospect|sales|demo|proposal/.test(t))                 return { label:"Client Facing", color:"var(--amber)" };
    if (/keynote|speak|panel|conference|summit|event|present/.test(t))          return { label:"Public Visibility", color:"var(--teal)" };
    if (/creative|agency|design|studio|brainstorm|workshop/.test(t))            return { label:"Creative Context", color:"var(--green)" };
    if (/interview|recruit|hire|candidate/.test(t))                             return { label:"Interview", color:"var(--amber)" };
    if (/dinner|lunch|breakfast|drinks|social|celebrat/.test(t))                return { label:"Social", color:"var(--muted)" };
    if (/team|standup|sync|1:1|one.on.one|collab|internal/.test(t))             return { label:"Internal", color:"var(--muted)" };
    return { label:"Professional", color:"var(--ink)" };
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
  };

  // ── Load today's calendar ──
  const loadCalendar = async () => {
    setCalLoading(true);
    setError("");
    try {
      const today = new Date();
      const start = new Date(today); start.setHours(0,0,0,0);
      const end   = new Date(today); end.setHours(23,59,59,999);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          mcp_servers:[{ type:"url", url:"https://calendarmcp.googleapis.com/mcp/v1", name:"google-calendar" }],
          messages:[{ role:"user", content:`List my calendar events for today between ${start.toISOString()} and ${end.toISOString()}. Return them ordered by start time.` }]
        })
      });
      const data = await response.json();
      // Extract tool results from MCP response
      const toolResults = data.content?.filter(b => b.type === "mcp_tool_result") || [];
      const textBlocks  = data.content?.filter(b => b.type === "text") || [];
      let events = [];
      for (const block of toolResults) {
        try { const parsed = JSON.parse(block.content?.[0]?.text || "{}"); if (parsed.items) events = parsed.items; } catch {}
      }
      // Fallback: parse from text if tool result not structured
      if (!events.length && textBlocks.length) {
        const raw = textBlocks.map(b => b.text).join(" ");
        // Simple heuristic — look for time patterns; actual events parsed from MCP structured output above
        events = [];
      }
      // Filter to non-all-day events with a start time
      const filtered = (events || [])
        .filter(e => e.start?.dateTime)
        .sort((a,b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));
      setCalEvents(filtered);
      setMode("calendar");
    } catch(e) {
      console.error(e);
      setError("Couldn't load your calendar. You can describe the occasion below instead.");
      setMode("manual");
    }
    setCalLoading(false);
  };

  // ── Generate outfit from occasion string ──
  const generate = async (occasionText) => {
    if (!occasionText?.trim() || wardrobe.length === 0) return;
    setLoading(true); setResult(null); setError("");
    try {
      const reply  = await callClaude([{ role:"user", content:occasionText }], buildDressSystem(brandDNA, wardrobe));
      const parsed = parseJSON(reply);
      parsed ? setResult(parsed) : setError("Couldn't generate recommendations — please try again.");
    } catch { setError("Something went wrong."); }
    setLoading(false);
  };

  const handleEventSelect = (ev) => {
    setSelectedEvent(ev);
    const ctx    = inferContext(ev.summary);
    const time   = formatTime(ev.start?.dateTime);
    const desc   = ev.description ? ` Notes: ${ev.description.replace(/<[^>]+>/g,"").slice(0,200)}` : "";
    const occasion = `${ev.summary}${time ? ` at ${time}` : ""}. Context: ${ctx.label}.${desc}`;
    generate(occasion);
  };

  const reset = () => { setResult(null); setEvent(""); setSelectedEvent(null); setMode("choose"); };
  const getItems = ids => (ids??[]).map(id => wardrobe.find(i => i.id===id)).filter(Boolean);

  return (
    <div style={{ minHeight:"100vh", paddingTop:56 }}>
      <div style={{ padding:"16px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:860, margin:"0 auto", paddingBottom:16 }}>
          <Cap style={{ marginBottom:5 }}>Dress For…</Cap>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:300 }}>Where are you going today?</h2>
        </div>
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"32px 24px" }}>
        {wardrobe.length === 0 ? (
          <div style={{ textAlign:"center", paddingTop:80, animation:"fadeUp 0.5s ease both" }}>
            <div style={{ width:58, height:58, borderRadius:"50%", border:"1.5px solid var(--border)", margin:"0 auto 28px", display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:20, height:20, borderRadius:"50%", border:"1.5px solid var(--teal-lt)" }} /></div>
            <p style={{ fontFamily:"var(--serif)", fontSize:22, marginBottom:14, fontWeight:300, maxWidth:340, margin:"0 auto 14px", lineHeight:1.3 }}>The most important brand you'll ever build is the one people experience when you walk in.</p>
            <p style={{ color:"var(--muted)", fontSize:13, margin:"0 auto 32px", maxWidth:320, fontWeight:300, lineHeight:1.75 }}>Add some pieces to your wardrobe first — then Dfine can dress you for any moment.</p>
            <button onClick={() => setScreen(SCREENS.WARDROBE)} style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"13px 28px", cursor:"pointer" }}>Build My Wardrobe →</button>
          </div>
        ) : result ? (
          /* ── Results ── */
          <div style={{ animation:"fadeUp 0.5s ease both" }}>
            <div style={{ padding:"14px 18px", background:"var(--surface)", marginBottom:22, display:"flex", justifyContent:"space-between", alignItems:"center", gap:16 }}>
              <div>
                {selectedEvent && <p style={{ fontSize:10, color:"var(--teal)", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:500, marginBottom:3 }}>{formatTime(selectedEvent.start?.dateTime)}</p>}
                <p style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", fontWeight:300 }}>{selectedEvent?.summary || event}</p>
              </div>
              <button onClick={reset} style={{ background:"none", border:"1px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", padding:"7px 14px", cursor:"pointer", flexShrink:0 }}>New Occasion</button>
            </div>
            <div style={{ padding:"24px 26px", background:"white", borderTop:"3px solid var(--teal)", marginBottom:28, boxShadow:"var(--shadow)" }}>
              <Cap style={{ marginBottom:10 }}>Reading the Room</Cap>
              <p style={{ fontSize:15, lineHeight:1.9, fontFamily:"var(--serif)", fontWeight:300, fontStyle:"italic" }}>{result.eventRead}</p>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {result.outfits?.map((outfit,i) => {
                const items  = getItems(outfit.itemIds);
                const accent = OUTFIT_ACCENTS[i%OUTFIT_ACCENTS.length];
                return (
                  <div key={i} style={{ background:"white", boxShadow:"var(--shadow)", borderTop:`2px solid ${accent}`, display:"grid", gridTemplateColumns:"1fr auto" }}>
                    <div style={{ padding:"22px 26px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                        <span style={{ fontSize:10, color:accent, letterSpacing:"0.18em", textTransform:"uppercase", fontWeight:600 }}>Look {String(i+1).padStart(2,"0")}</span>
                        <div style={{ flex:1, height:1, background:"var(--border)" }} />
                      </div>
                      <h3 style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:300, marginBottom:18 }}>{outfit.name}</h3>
                      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                        <div><Cap style={{ marginBottom:5, fontSize:9, color:"var(--muted)" }}>For This Moment</Cap><p style={{ fontSize:13, lineHeight:1.8, fontWeight:300 }}>{outfit.rationale}</p></div>
                        <div><Cap style={{ marginBottom:5, fontSize:9, color:"var(--muted)" }}>Your Brand Story</Cap><p style={{ fontSize:13, lineHeight:1.8, fontWeight:300 }}>{outfit.brandNote}</p></div>
                        {outfit.tip && <div style={{ padding:"12px 16px", background:"var(--surface)", borderLeft:`2px solid ${accent}` }}><p style={{ fontSize:9, color:"var(--muted)", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:4, fontWeight:500 }}>One Small Thing</p><p style={{ fontSize:13, lineHeight:1.75, fontWeight:300 }}>{outfit.tip}</p></div>}
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div style={{ borderLeft:"1px solid var(--border)", minWidth:162, display:"flex", flexDirection:"column" }}>
                        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)" }}><Cap style={{ color:"var(--muted)", fontSize:9 }}>From Your Wardrobe</Cap></div>
                        {items.map((item,j) => (
                          <div key={j} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderBottom:j<items.length-1?"1px solid rgba(20,20,18,0.06)":"none" }}>
                            <img src={item.preview} alt={item.name} style={{ width:42, height:52, objectFit:"cover", flexShrink:0, border:`1.5px solid ${verdictColor(item.verdict)}` }} />
                            <div><p style={{ fontSize:12, fontWeight:500, lineHeight:1.4 }}>{item.name}</p><p style={{ fontSize:10, color:"var(--muted)", fontWeight:300 }}>{item.category}</p></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        ) : loading ? (
          <div style={{ textAlign:"center", paddingTop:72, animation:"fadeIn 0.4s ease both" }}>
            <Spinner size={20} />
            <p style={{ fontSize:13, color:"var(--muted)", marginTop:20, fontStyle:"italic", fontWeight:300 }}>Reading the room…</p>
          </div>

        ) : mode === "choose" ? (
          /* ── Entry point — choose mode ── */
          <div style={{ animation:"fadeUp 0.4s ease both", display:"flex", flexDirection:"column", gap:3 }}>
            <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.8, fontWeight:300, marginBottom:24, maxWidth:480 }}>
              Tell Dfine what you're walking into — or let it read your day.
            </p>

            {/* Calendar option */}
            <button onClick={loadCalendar} disabled={calLoading}
              style={{ background:"white", border:"none", boxShadow:"var(--shadow)", padding:"24px 26px", textAlign:"left", cursor:"pointer", borderLeft:"3px solid var(--teal)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, transition:"box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow="var(--shadow-md)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow="var(--shadow)"}>
              <div>
                <p style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:300, marginBottom:4 }}>
                  {calLoading ? "Reading your calendar…" : "Read my day"}
                </p>
                <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300 }}>Pull today's events and choose which one you're dressing for</p>
              </div>
              {calLoading ? <Spinner size={16} /> : <span style={{ fontSize:18, color:"var(--teal)" }}>→</span>}
            </button>

            {/* Manual option */}
            <button onClick={() => setMode("manual")}
              style={{ background:"var(--surface)", border:"none", padding:"24px 26px", textAlign:"left", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, transition:"box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow="var(--shadow)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
              <div>
                <p style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:300, marginBottom:4 }}>Describe the occasion</p>
                <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300 }}>Tell Dfine where you're going and what's at stake</p>
              </div>
              <span style={{ fontSize:18, color:"var(--muted)" }}>→</span>
            </button>

            {error && <p style={{ fontSize:12, color:"var(--red)", marginTop:12, fontStyle:"italic" }}>{error}</p>}
          </div>

        ) : mode === "calendar" ? (
          /* ── Calendar event list ── */
          <div style={{ animation:"fadeUp 0.4s ease both" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <p style={{ fontSize:13, color:"var(--muted)", fontWeight:300 }}>
                {calEvents.length > 0 ? "Which one are you dressing for today?" : "No events found for today."}
              </p>
              <button onClick={() => setMode("choose")} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>← Back</button>
            </div>

            {calEvents.length > 0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                {calEvents.map((ev, i) => {
                  const ctx = inferContext(ev.summary);
                  return (
                    <button key={i} onClick={() => handleEventSelect(ev)}
                      style={{ background:"white", border:"none", boxShadow:"var(--shadow)", padding:"18px 22px", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:18, borderLeft:`3px solid ${ctx.color}`, transition:"box-shadow 0.2s", animation:`fadeUp 0.4s ease ${i*0.06}s both` }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow="var(--shadow-md)"}
                      onMouseLeave={e => e.currentTarget.style.boxShadow="var(--shadow)"}>
                      <div style={{ flexShrink:0, textAlign:"center", minWidth:44 }}>
                        <p style={{ fontSize:11, color:"var(--muted)", fontWeight:300 }}>{formatTime(ev.start?.dateTime)}</p>
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontFamily:"var(--serif)", fontSize:17, fontWeight:300, marginBottom:3 }}>{ev.summary}</p>
                        {ev.location && <p style={{ fontSize:11, color:"var(--muted)", fontWeight:300 }}>{ev.location}</p>}
                      </div>
                      <span style={{ fontSize:10, color:ctx.color, fontWeight:500, letterSpacing:"0.1em", textTransform:"uppercase", flexShrink:0 }}>{ctx.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign:"center", paddingTop:40 }}>
                <p style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", marginBottom:20 }}>No events found. Describe the occasion instead.</p>
                <button onClick={() => setMode("manual")} style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"12px 24px", cursor:"pointer" }}>Describe Occasion</button>
              </div>
            )}

            <div style={{ marginTop:16, textAlign:"center" }}>
              <button onClick={() => setMode("manual")} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
                Not on the list — describe it instead
              </button>
            </div>
          </div>

        ) : (
          /* ── Manual text entry ── */
          <div style={{ animation:"fadeUp 0.4s ease both" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <p style={{ fontSize:13, color:"var(--muted)", fontWeight:300, maxWidth:480, lineHeight:1.8 }}>Describe what you're walking into. The more context — the stakes, who'll be there, what you want them to feel — the sharper the recommendation.</p>
              <button onClick={() => setMode("choose")} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", flexShrink:0, marginLeft:16 }}>← Back</button>
            </div>
            <textarea value={event} onChange={e => setEvent(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey&&event.trim()){e.preventDefault();generate(event);} }}
              placeholder={"e.g. Board presentation — 60 investors. Authority without losing warmth.\n\ne.g. Keynote at a design conference. Practitioner, not a suit.\n\ne.g. Lunch with a potential mentor. Thoughtful and genuine."}
              rows={6} style={{ width:"100%", background:"white", borderLeft:"3px solid var(--teal)", border:"none", color:"var(--ink)", fontFamily:"var(--sans)", fontSize:14, fontWeight:300, padding:"20px 22px", resize:"none", outline:"none", lineHeight:1.75, boxShadow:"var(--shadow)" }} />
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:14 }}>
              <button onClick={() => generate(event)} disabled={!event.trim()||loading}
                style={{ background:event.trim()&&!loading?"var(--ink)":"transparent", border:`1.5px solid ${event.trim()&&!loading?"var(--ink)":"var(--border)"}`, color:event.trim()&&!loading?"var(--bg)":"var(--muted)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"12px 28px", cursor:event.trim()&&!loading?"pointer":"default", display:"flex", alignItems:"center", gap:10 }}>
                {loading?<><Spinner size={13} /><span>Finding your look…</span></>:"Find My Look"}
              </button>
            </div>
          </div>
        )}

        {error && !loading && mode !== "choose" && <p style={{ color:"var(--red)", fontSize:13, textAlign:"center", marginTop:20 }}>{error}</p>}
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const ONBOARDING_SLIDES = [
  {
    cap: "Welcome to Dfine",
    heading: "Two tools.\nOne foundation.",
    body: null,
    cards: [
      { icon:"◎", title:"The Mirror", tag:"Once off — revisited when you've changed", desc:"A structured brand discovery session. Do it once when you're establishing yourself, repositioning, or when you've outgrown your last version. Takes 15 minutes. The output lasts months." },
      { icon:"◈", title:"The Wardrobe", tag:"Ongoing — a daily tool", desc:"Snap an outfit and every item is detected and assessed automatically. Or add items one by one. It gets smarter the more it knows about your brand." },
    ],
    note: "The Mirror reveals your Brand DNA at the end of the session — not before. The thinking you do along the way is what makes the output specific to you. You'll know why that matters when you get there.",
  },
  {
    cap: "What you'll walk away with",
    heading: "Not just 'your brand'.\nEverything that flows from it.",
    body: "Most people are surprised by how much comes out of a 15-minute conversation. Here's what The Mirror produces — named explicitly, so you go in knowing what you're building.",
    outputs: [
      { label:"Professional Stance",    desc:"How others experience you — the position you naturally occupy in any professional room" },
      { label:"Positioning Statement",   desc:"What you do and who it's for. One precise, ownable sentence" },
      { label:"Tone of Voice",           desc:"How you sound — on LinkedIn, in emails, bios, presentations, pitches" },
      { label:"Key Message",             desc:"The one thing you want to be known for" },
      { label:"Style Direction",         desc:"How your visual presence should read — clothes, photos, design choices" },
      { label:"Audience Definition",     desc:"Who specifically needs to understand you, and what they need to feel" },
    ],
    footer: "This profile becomes the lens through which your wardrobe is assessed. Without it, you get general advice. With it, you get brand-specific feedback.",
  },
  {
    cap: "Building your wardrobe",
    heading: "Two ways in.\nOne catalogue.",
    body: null,
    cards: [
      { icon:"◎", title:"Snap an Outfit", tag:"Fast — whole outfit at once", desc:"Photograph what you're wearing. Every item is detected automatically, assessed against your Brand DNA, and added to your wardrobe. Do it daily or whenever you get dressed for something that matters." },
      { icon:"◈", title:"Add an Item", tag:"Deliberate — one piece at a time", desc:"Photograph a single piece — in a fitting room, from an online listing, from your wardrobe at home. Useful for auditing what you own or assessing a potential purchase before you buy." },
    ],
  },
];

function OnboardingScreen({ onComplete }) {
  const [slide, setSlide] = useState(0);
  const total = ONBOARDING_SLIDES.length;
  const s     = ONBOARDING_SLIDES[slide];
  const last  = slide === total - 1;

  const next = () => last ? onComplete() : setSlide(i => i + 1);
  const prev = () => setSlide(i => i - 1);

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid var(--border)" }}>
        <Logo />
        <button onClick={onComplete} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", cursor:"pointer", fontWeight:300 }}>Skip intro</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"40px 24px 24px" }}>
        <div style={{ maxWidth:580, margin:"0 auto", animation:"fadeUp 0.5s ease both" }}>
          <Cap style={{ marginBottom:14 }}>{s.cap}</Cap>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:"clamp(30px,5vw,46px)", fontWeight:300, lineHeight:1.08, marginBottom:28, whiteSpace:"pre-line" }}>{s.heading}</h2>
          {s.body && <p style={{ fontSize:14, color:"var(--muted)", lineHeight:1.8, fontWeight:300, marginBottom:32 }}>{s.body}</p>}

          {s.cards && (
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {s.cards.map((card, i) => (
                <div key={i} style={{ padding:"22px 24px", background:"white", boxShadow:"var(--shadow)", borderLeft:`3px solid ${i===0?"var(--teal)":"var(--green)"}`, animation:`fadeUp 0.5s ease ${i*0.1}s both` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:20, color:i===0?"var(--teal)":"var(--green)" }}>{card.icon}</span>
                    <div>
                      <p style={{ fontFamily:"var(--serif)", fontSize:18, fontWeight:500 }}>{card.title}</p>
                      <p style={{ fontSize:10, color:i===0?"var(--teal)":"var(--green)", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:500, marginTop:2 }}>{card.tag}</p>
                    </div>
                  </div>
                  <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.75, fontWeight:300 }}>{card.desc}</p>
                </div>
              ))}
              {s.note && (
                <div style={{ padding:"16px 20px", background:"var(--surface)", borderLeft:"3px solid var(--bstrong)", animation:"fadeUp 0.5s ease 0.2s both" }}>
                  <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.75, fontWeight:300, fontStyle:"italic" }}>{s.note}</p>
                </div>
              )}
            </div>
          )}

          {s.outputs && (
            <div>
              <div style={{ display:"flex", flexDirection:"column", gap:1, marginBottom:24 }}>
                {s.outputs.map((o, i) => (
                  <div key={i} style={{ padding:"14px 18px", background:"white", boxShadow:"0 1px 6px rgba(20,20,18,0.04)", display:"flex", gap:14, alignItems:"flex-start", animation:`fadeUp 0.4s ease ${i*0.07}s both` }}>
                    <span style={{ color:"var(--teal)", fontSize:14, flexShrink:0, marginTop:1 }}>✦</span>
                    <div>
                      <p style={{ fontSize:13, fontWeight:500, marginBottom:3 }}>{o.label}</p>
                      <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.65, fontWeight:300 }}>{o.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"16px 20px", background:"var(--teal-bg)", borderLeft:"3px solid var(--teal)" }}>
                <p style={{ fontSize:13, color:"var(--ink)", lineHeight:1.75, fontWeight:300, fontStyle:"italic" }}>{s.footer}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:"20px 24px", borderTop:"1px solid var(--border)", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {Array.from({ length:total }).map((_, i) => (
            <div key={i} onClick={() => setSlide(i)} style={{ width:i===slide?20:6, height:6, borderRadius:3, background:i===slide?"var(--teal)":i<slide?"var(--teal-lt)":"var(--border)", transition:"all 0.3s ease", cursor:"pointer" }} />
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {slide > 0 && (
            <button onClick={prev} style={{ background:"none", border:"1.5px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.14em", textTransform:"uppercase", padding:"12px 22px", cursor:"pointer" }}>Back</button>
          )}
          <button onClick={next}
            onMouseEnter={e => { e.currentTarget.style.background="var(--teal)"; e.currentTarget.style.borderColor="var(--teal)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="var(--ink)"; e.currentTarget.style.borderColor="var(--ink)"; }}
            style={{ background:"var(--ink)", color:"var(--bg)", border:"1.5px solid var(--ink)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"12px 28px", cursor:"pointer", transition:"all 0.2s" }}>
            {last ? "I'm ready — let's begin" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ABOUT SCREEN ─────────────────────────────────────────────────────────────
function AboutScreen({ brandDNA }) {
  const [about, setAbout]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    setAbout("");
    try {
      const reply = await callClaude(
        [{ role:"user", content:"Write my professional About paragraph." }],
        buildAboutSystem(brandDNA),
        null, 400
      );
      setAbout(reply.trim());
      setGenerated(true);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(about).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div style={{ minHeight:"100vh", paddingTop:56, background:"var(--bg)" }}>
      <div style={{ maxWidth:680, margin:"0 auto", padding:"48px 24px 80px" }}>

        <div style={{ marginBottom:36, animation:"fadeUp 0.5s ease both" }}>
          <Cap style={{ marginBottom:14 }}>Your About</Cap>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:"clamp(28px,5vw,42px)", fontWeight:300, lineHeight:1.1, marginBottom:16 }}>
            The paragraph that sits underneath<br />
            <span style={{ color:"var(--teal)", fontStyle:"italic" }}>every professional introduction.</span>
          </h2>
          <p style={{ fontSize:14, color:"var(--muted)", lineHeight:1.8, fontWeight:300, maxWidth:520 }}>
            Drop it into a bio, a LinkedIn about section, a pitch deck, a speaker profile, or read it aloud as an introduction. It adapts to every format because it starts from something true.
          </p>
        </div>

        {!generated && !loading && (
          <div style={{ animation:"fadeUp 0.5s ease 0.1s both" }}>
            <div style={{ padding:"24px 28px", background:"var(--surface)", border:"1px solid var(--border)", borderLeft:"3px solid var(--teal)", marginBottom:28 }}>
              <Cap style={{ marginBottom:10, color:"var(--muted)" }}>Drawn from your Brand DNA</Cap>
              <p style={{ fontSize:13, color:"var(--ink)", lineHeight:1.8, fontWeight:300, fontFamily:"var(--serif)", fontStyle:"italic" }}>
                {brandDNA.split("\n").slice(0,3).join(" · ")}
              </p>
            </div>
            <button onClick={generate}
              onMouseEnter={e => { e.currentTarget.style.background="var(--teal)"; e.currentTarget.style.borderColor="var(--teal)"; }}
              onMouseLeave={e => { e.currentTarget.style.background="var(--ink)"; e.currentTarget.style.borderColor="var(--ink)"; }}
              style={{ background:"var(--ink)", color:"var(--bg)", border:"1.5px solid var(--ink)", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"14px 36px", cursor:"pointer", transition:"all 0.2s" }}>
              Write My About
            </button>
          </div>
        )}

        {loading && (
          <div style={{ display:"flex", alignItems:"center", gap:14, padding:"32px 0", animation:"fadeIn 0.3s ease both" }}>
            <Spinner size={18} />
            <p style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", fontWeight:300 }}>Writing from your Brand DNA…</p>
          </div>
        )}

        {generated && about && (
          <div style={{ animation:"fadeUp 0.5s ease both" }}>
            <div style={{ padding:"32px 36px", background:"white", boxShadow:"var(--shadow-md)", borderTop:"3px solid var(--teal)", marginBottom:20 }}>
              <p style={{ fontFamily:"var(--serif)", fontSize:"clamp(16px,2.2vw,20px)", lineHeight:1.85, fontWeight:300, color:"var(--ink)" }}>
                {about}
              </p>
            </div>

            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:32 }}>
              <button onClick={copy}
                style={{ background:copied?"var(--green)":"var(--ink)", color:"var(--bg)", border:`1.5px solid ${copied?"var(--green)":"var(--ink)"}`, fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", padding:"12px 28px", cursor:"pointer", transition:"all 0.2s" }}>
                {copied ? "Copied ✓" : "Copy to Clipboard"}
              </button>
              <button onClick={generate}
                style={{ background:"none", color:"var(--muted)", border:"1.5px solid var(--border)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.14em", textTransform:"uppercase", padding:"12px 22px", cursor:"pointer", transition:"all 0.2s" }}>
                Regenerate
              </button>
            </div>

            <div style={{ padding:"20px 24px", background:"var(--surface)", border:"1px solid var(--border)" }}>
              <Cap style={{ marginBottom:10, color:"var(--muted)" }}>Where to use this</Cap>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {["LinkedIn About section","Pitch deck introduction slide","Conference speaker profile","Email signature context","Website bio","Spoken introduction at events"].map((u,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ color:"var(--teal)", fontSize:12 }}>✦</span>
                    <p style={{ fontSize:13, color:"var(--muted)", fontWeight:300 }}>{u}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CHANGE-ROOM VALIDATOR ────────────────────────────────────────────────────

function CountdownBadge({ expiresAt }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setLabel("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(h > 23 ? `${Math.floor(h/24)}d ${h%24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const urgent = expiresAt - Date.now() < 3600000 && expiresAt > Date.now();
  const expired = expiresAt <= Date.now();
  return (
    <span style={{ fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:500,
      color: expired ? "var(--muted)" : urgent ? "var(--red)" : "var(--amber)" }}>
      {expired ? "Expired" : `⏱ ${label}`}
    </span>
  );
}

function ConfidenceMeter({ value }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, height:2, background:"var(--border)", borderRadius:2, position:"relative" }}>
        <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${value}%`, background:"var(--teal)", borderRadius:2, transition:"width 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </div>
      <span style={{ fontSize:11, color:"var(--muted)", fontWeight:400, minWidth:32, textAlign:"right" }}>{value}%</span>
    </div>
  );
}

function ChangeRoomScreen({ brandDNA, considering, setConsidering }) {
  const [view,      setView]    = useState("intro");    // intro | input | context | verdict | dashboard
  const [base64,    setBase64]  = useState(null);
  const [preview,   setPreview] = useState(null);
  const [crContext, setCrContext] = useState({ retailer:"", occasion:"", urgencyHours:24, price:"", link:"", productName:"" });
  const [result,    setResult]  = useState(null);
  const [loading,   setLoading] = useState(false);
  const [dragOver,  setDragOver] = useState(false);
  const [dashFilter, setDashFilter] = useState("all");
  const [copied,    setCopied]  = useState(false);
  const fileRef = useRef();

  const OCCASIONS = [
    "Everyday office", "Client meeting", "Board presentation", "Networking event",
    "Team leadership", "Conference / speaking", "Business casual social", "Other"
  ];

  function compressImage(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 1024;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) { if (w > h) { h = h*(MAX/w); w = MAX; } else { w = w*(MAX/h); h = MAX; } }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file) {
    setPreview(URL.createObjectURL(file));
    const b64 = await compressImage(file);
    setBase64(b64);
  }

  async function runAssessment() {
    if (!base64) return;
    setLoading(true);
    setView("verdict");
    try {
      const system = buildChangeRoomSystem(brandDNA, crContext);
      const raw = await callClaude(
        [{ role:"user", content: crContext.productName
            ? `Please assess this item: ${crContext.productName}. ${crContext.occasion ? `I'd wear it for: ${crContext.occasion}.` : ""}`
            : `Please assess this item for me.${crContext.occasion ? ` I'd wear it for: ${crContext.occasion}.` : ""}` }],
        system, base64, 900
      );
      const parsed = parseJSON(raw);
      if (parsed) setResult(parsed);
      else setResult({ verdict:"◈ Buy with Caveats", verdictLabel:"On Brand with Caveats", confidence:60, itemDescription:"Item analysed", rationale: raw, actionableGuidance:"", occasionFit:"", gapAnalysis:"", brandTags:[], signals:{socialCategory:5,cognitiveState:5,status:5,aestheticCoherence:5} });
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  function saveToConsidering(status = "pending") {
    if (!result) return;
    const item = {
      id: `cr_${Date.now()}`,
      addedAt: Date.now(),
      expiresAt: Date.now() + (crContext.urgencyHours * 3600000),
      status,
      imagePreview: preview,
      verdict: result.verdict,
      verdictLabel: result.verdictLabel,
      confidence: result.confidence,
      itemDescription: result.itemDescription,
      brandTags: result.brandTags || [],
      signals: result.signals,
      rationale: result.rationale,
      actionableGuidance: result.actionableGuidance,
      occasionFit: result.occasionFit,
      gapAnalysis: result.gapAnalysis,
      retailer: crContext.retailer,
      occasion: crContext.occasion,
      price: crContext.price,
      link: crContext.link,
      productName: crContext.productName || result.itemDescription,
    };
    setConsidering(prev => [item, ...prev]);
    return item;
  }

  function resetFlow() {
    setView("intro");
    setBase64(null);
    setPreview(null);
    setCrContext({ retailer:"", occasion:"", urgencyHours:24, price:"", link:"", productName:"" });
    setResult(null);
    setLoading(false);
  }

  function updateItemStatus(id, status) {
    setConsidering(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  }

  // ─ Analytics
  const total = considering.length;
  const approved = considering.filter(i => i.status === "purchased" || (i.verdict?.includes("Buy It") && i.status !== "rejected")).length;
  const purchased = considering.filter(i => i.status === "purchased").length;
  const approvalRate = total > 0 ? Math.round((considering.filter(i => i.verdict?.includes("Buy It")).length / total) * 100) : 0;
  const purchaseRate = total > 0 ? Math.round((purchased / total) * 100) : 0;

  const filtered = considering.filter(i => {
    if (dashFilter === "all") return true;
    if (dashFilter === "pending") return i.status === "pending" && i.expiresAt > Date.now();
    if (dashFilter === "approved") return i.verdict?.includes("Buy It") && i.status === "pending";
    if (dashFilter === "rejected") return i.status === "rejected";
    if (dashFilter === "purchased") return i.status === "purchased";
    if (dashFilter === "expired") return i.expiresAt <= Date.now() && i.status === "pending";
    return true;
  });

  const inputStyle = { width:"100%", padding:"11px 14px", background:"white", border:"1px solid var(--border)", borderRadius:0, fontFamily:"var(--sans)", fontSize:13, fontWeight:300, color:"var(--ink)", outline:"none" };
  const labelStyle = { fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--muted)", fontWeight:400, display:"block", marginBottom:6 };

  // ─────────────────────────────────────────────
  // INTRO
  // ─────────────────────────────────────────────
  if (view === "intro") return (
    <div style={{ minHeight:"100vh", paddingTop:56 }}>
      <div style={{ padding:"16px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:720, margin:"0 auto", paddingBottom:16, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <Cap style={{ marginBottom:5 }}>Change Room</Cap>
            <h2 style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:300 }}>Validate before you buy.</h2>
          </div>
          {considering.length > 0 && (
            <button onClick={() => setView("dashboard")}
              style={{ background:"none", border:"1px solid var(--border)", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", padding:"8px 16px", cursor:"pointer" }}>
              Considering ({considering.length})
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"40px 24px" }}>

        {/* Hero entry card */}
        <div style={{ background:"var(--ink)", padding:"40px 36px", marginBottom:24, animation:"fadeUp 0.5s ease both", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%", border:"1px solid rgba(255,255,255,0.05)" }} />
          <div style={{ position:"absolute", top:-20, right:-20, width:120, height:120, borderRadius:"50%", border:"1px solid rgba(29,158,117,0.15)" }} />
          <Cap style={{ color:"var(--teal-lt)", marginBottom:14 }}>New session</Cap>
          <h3 style={{ fontFamily:"var(--serif)", fontSize:"clamp(22px,4vw,30px)", fontWeight:300, color:"white", lineHeight:1.2, marginBottom:14 }}>
            Try pieces risk-free<br/>in our change room.
          </h3>
          <p style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.8, fontWeight:300, marginBottom:32, maxWidth:420 }}>
            See how a prospective purchase aligns with your Brand DNA before you commit.
            We remember what you considered, approved, and rejected.
          </p>
          <button onClick={() => setView("input")}
            style={{ background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.17em", textTransform:"uppercase", padding:"14px 32px", cursor:"pointer", transition:"opacity 0.18s" }}
            onMouseEnter={e => e.target.style.opacity = "0.88"}
            onMouseLeave={e => e.target.style.opacity = "1"}>
            Validate a Purchase →
          </button>
        </div>

        {/* How it works */}
        <div style={{ marginBottom:32, animation:"fadeUp 0.5s 0.1s ease both", opacity:0 }}>
          <Cap style={{ marginBottom:16, color:"var(--muted)" }}>How it works</Cap>
          {[
            { num:"01", label:"Photograph or describe the item", sub:"From a store, online listing, or barcode scan." },
            { num:"02", label:"Set your context", sub:"Tell us the occasion and how urgently you need to decide." },
            { num:"03", label:"Get a real-time verdict", sub:"On Brand DNA alignment, occasion fit, and whether to buy." },
            { num:"04", label:"Save to your Considering list", sub:"48-hour window to decide — we track what you considered and what you chose." },
          ].map((s, i) => (
            <div key={i} style={{ display:"flex", gap:18, padding:"14px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontFamily:"var(--serif)", fontSize:14, color:"var(--teal-lt)", fontWeight:300, minWidth:22, paddingTop:1 }}>{s.num}</span>
              <div>
                <p style={{ fontSize:13, fontWeight:400, color:"var(--ink)", marginBottom:2 }}>{s.label}</p>
                <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300 }}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard shortcut if items exist */}
        {considering.length > 0 && (
          <div style={{ animation:"fadeUp 0.5s 0.2s ease both", opacity:0 }}>
            <button onClick={() => setView("dashboard")}
              style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", color:"var(--ink)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.14em", textTransform:"uppercase", padding:"14px", cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Items You're Considering</span>
              <span style={{ color:"var(--teal)", fontWeight:500 }}>{considering.length} item{considering.length!==1?"s":""} →</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // INPUT
  // ─────────────────────────────────────────────
  if (view === "input") return (
    <div style={{ minHeight:"100vh", paddingTop:56 }}>
      <div style={{ padding:"16px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:640, margin:"0 auto", paddingBottom:16, display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={() => setView("intro")} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:18, padding:0, lineHeight:1 }}>←</button>
          <div>
            <Cap style={{ marginBottom:2 }}>Step 1 of 2</Cap>
            <h2 style={{ fontFamily:"var(--serif)", fontSize:22, fontWeight:300 }}>Show us the item.</h2>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:"32px 24px" }}>

        {/* Photo upload zone */}
        <div style={{ marginBottom:28 }}>
          <label style={labelStyle}>Upload a photo</label>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
            onChange={e => { if (e.target.files[0]) { handleFile(e.target.files[0]); } e.target.value=""; }} />

          <div onClick={() => !preview && fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (!preview && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            style={{ border:`1.5px dashed ${dragOver ? "var(--teal)" : preview ? "var(--teal)" : "var(--bstrong)"}`, minHeight:260, display:"flex", alignItems:"center", justifyContent:"center", background:dragOver ? "var(--teal-bg)" : "white", overflow:"hidden", transition:"all 0.2s", position:"relative", cursor:preview?"default":"pointer" }}>
            {preview ? (
              <>
                <img src={preview} alt="" style={{ maxHeight:280, maxWidth:"100%", objectFit:"contain" }} />
                <button onClick={e => { e.stopPropagation(); setPreview(null); setBase64(null); }}
                  style={{ position:"absolute", top:10, right:10, background:"var(--ink)", border:"none", color:"white", width:28, height:28, borderRadius:"50%", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </>
            ) : (
              <div style={{ textAlign:"center", padding:36 }}>
                <div style={{ width:52, height:52, borderRadius:"50%", border:"1.5px solid var(--bstrong)", margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ width:18, height:18, borderRadius:"50%", border:"1.5px solid var(--teal-lt)" }} />
                </div>
                <p style={{ fontFamily:"var(--serif)", fontSize:18, marginBottom:6, fontWeight:300 }}>Photo of the item</p>
                <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300, lineHeight:1.7 }}>From your camera, a screenshot,<br />or an online listing image.</p>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
          <div style={{ flex:1, height:1, background:"var(--border)" }} />
          <span style={{ fontSize:10, color:"var(--muted)", letterSpacing:"0.14em", textTransform:"uppercase" }}>or describe it</span>
          <div style={{ flex:1, height:1, background:"var(--border)" }} />
        </div>

        {/* Text description */}
        <div style={{ marginBottom:28 }}>
          <label style={labelStyle}>Product name or description</label>
          <input style={inputStyle} placeholder="e.g. Navy wool blazer, single-button, slim cut — ZARA"
            value={crContext.productName}
            onChange={e => setCrContext(c => ({ ...c, productName:e.target.value }))} />
          <p style={{ fontSize:11, color:"var(--muted)", marginTop:6, fontWeight:300 }}>If you have a photo, the visual read will be sharper. Text alone also works.</p>
        </div>

        {/* Retail integration hooks */}
        <div style={{ display:"flex", gap:10, marginBottom:36 }}>
          {[
            { label:"Paste a product URL", icon:"🔗", note:"Shopify, retailer link" },
            { label:"Scan barcode", icon:"⠿", note:"In-store scanning" },
          ].map((h, i) => (
            <div key={i} style={{ flex:1, padding:"14px 16px", background:"var(--surface)", border:"1px solid var(--border)", opacity:0.6 }}>
              <p style={{ fontSize:16, marginBottom:4 }}>{h.icon}</p>
              <p style={{ fontSize:11, fontWeight:500, marginBottom:2, color:"var(--ink)" }}>{h.label}</p>
              <p style={{ fontSize:10, color:"var(--muted)", fontWeight:300 }}>{h.note} · Coming soon</p>
            </div>
          ))}
        </div>

        <button onClick={() => setView("context")}
          disabled={!base64 && !crContext.productName.trim()}
          style={{ width:"100%", background:(!base64 && !crContext.productName.trim()) ? "var(--border)" : "var(--ink)", color:(!base64 && !crContext.productName.trim()) ? "var(--muted)" : "var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.17em", textTransform:"uppercase", padding:"15px", cursor:(!base64 && !crContext.productName.trim()) ? "default" : "pointer", transition:"all 0.18s" }}>
          Continue →
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // CONTEXT
  // ─────────────────────────────────────────────
  if (view === "context") return (
    <div style={{ minHeight:"100vh", paddingTop:56 }}>
      <div style={{ padding:"16px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:640, margin:"0 auto", paddingBottom:16, display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={() => setView("input")} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:18, padding:0, lineHeight:1 }}>←</button>
          <div>
            <Cap style={{ marginBottom:2 }}>Step 2 of 2</Cap>
            <h2 style={{ fontFamily:"var(--serif)", fontSize:22, fontWeight:300 }}>Set your context.</h2>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:"32px 24px" }}>

        {/* Preview thumbnail */}
        {preview && (
          <div style={{ marginBottom:24, display:"flex", alignItems:"center", gap:16, padding:"14px 18px", background:"white", boxShadow:"var(--shadow)", borderLeft:"3px solid var(--teal)" }}>
            <img src={preview} alt="" style={{ width:56, height:56, objectFit:"cover", flexShrink:0 }} />
            <div>
              <Cap style={{ marginBottom:2, fontSize:9 }}>Item ready</Cap>
              <p style={{ fontSize:13, fontWeight:300, color:"var(--muted)" }}>{crContext.productName || "Photo uploaded"}</p>
            </div>
          </div>
        )}

        {/* Occasion */}
        <div style={{ marginBottom:24 }}>
          <label style={labelStyle}>What's the occasion you'd wear this for?</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {OCCASIONS.map(o => (
              <button key={o} onClick={() => setCrContext(c => ({ ...c, occasion: c.occasion === o ? "" : o }))}
                style={{ background:crContext.occasion===o ? "var(--ink)" : "white", color:crContext.occasion===o ? "var(--bg)" : "var(--muted)", border:`1px solid ${crContext.occasion===o ? "var(--ink)" : "var(--border)"}`, fontFamily:"var(--sans)", fontSize:11, fontWeight:300, letterSpacing:"0.08em", padding:"8px 14px", cursor:"pointer", transition:"all 0.15s" }}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Retailer */}
        <div style={{ marginBottom:24 }}>
          <label style={labelStyle}>Where are you considering buying this? (optional)</label>
          <input style={inputStyle} placeholder="e.g. ZARA, Uniqlo, Mr Porter, David Jones…"
            value={crContext.retailer}
            onChange={e => setCrContext(c => ({ ...c, retailer:e.target.value }))} />
        </div>

        {/* Price */}
        <div style={{ marginBottom:24 }}>
          <label style={labelStyle}>Price (optional)</label>
          <input style={{ ...inputStyle, maxWidth:200 }} placeholder="e.g. $189"
            value={crContext.price}
            onChange={e => setCrContext(c => ({ ...c, price:e.target.value }))} />
        </div>

        {/* Decision window */}
        <div style={{ marginBottom:36 }}>
          <label style={labelStyle}>How long do you have to decide?</label>
          <div style={{ display:"flex", gap:8 }}>
            {[{ h:1, label:"1 hour" }, { h:6, label:"6 hours" }, { h:24, label:"24 hours" }, { h:48, label:"48 hours" }].map(({ h, label }) => (
              <button key={h} onClick={() => setCrContext(c => ({ ...c, urgencyHours:h }))}
                style={{ flex:1, background:crContext.urgencyHours===h ? "var(--ink)" : "white", color:crContext.urgencyHours===h ? "var(--bg)" : "var(--muted)", border:`1px solid ${crContext.urgencyHours===h ? "var(--ink)" : "var(--border)"}`, fontFamily:"var(--sans)", fontSize:11, fontWeight:300, padding:"9px 0", cursor:"pointer", transition:"all 0.15s", textAlign:"center" }}>
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontSize:11, color:"var(--muted)", marginTop:8, fontWeight:300 }}>After this window, the item moves to Expired. You can always extend it.</p>
        </div>

        <button onClick={runAssessment}
          style={{ width:"100%", background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.17em", textTransform:"uppercase", padding:"15px", cursor:"pointer" }}>
          Get My Verdict →
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // VERDICT
  // ─────────────────────────────────────────────
  if (view === "verdict") return (
    <div style={{ minHeight:"100vh", paddingTop:56 }}>
      <div style={{ padding:"16px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:640, margin:"0 auto", paddingBottom:16 }}>
          <Cap style={{ marginBottom:5 }}>Change Room</Cap>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:22, fontWeight:300 }}>
            {loading ? "Reading the signals…" : "Your verdict."}
          </h2>
        </div>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:"32px 24px" }}>

        {loading && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:80, gap:24, animation:"fadeIn 0.3s ease both" }}>
            {preview && <img src={preview} alt="" style={{ width:120, height:120, objectFit:"cover", opacity:0.6 }} />}
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <Spinner size={18} />
              <p style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", fontWeight:300 }}>Assessing against your Brand DNA…</p>
            </div>
            <div style={{ width:"100%", maxWidth:320, height:1, background:"var(--border)", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, transparent, var(--teal), transparent)", animation:"scanline 1.8s linear infinite" }} />
            </div>
          </div>
        )}

        {!loading && result && (
          <div style={{ animation:"fadeUp 0.5s ease both" }}>

            {/* Verdict hero */}
            <div style={{ background:crVerdictBg(result.verdict), border:`1.5px solid ${crVerdictColor(result.verdict)}22`, padding:"28px 28px", marginBottom:16, position:"relative", overflow:"hidden" }}>
              {preview && (
                <div style={{ position:"absolute", right:20, top:20, width:72, height:72, overflow:"hidden", opacity:0.9 }}>
                  <img src={preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                </div>
              )}
              <Cap style={{ marginBottom:8, color:crVerdictColor(result.verdict) }}>Verdict</Cap>
              <p style={{ fontFamily:"var(--serif)", fontSize:"clamp(22px,4vw,30px)", fontWeight:300, color:crVerdictColor(result.verdict), marginBottom:4, lineHeight:1.1 }}>
                {result.verdict}
              </p>
              <p style={{ fontSize:12, color:"var(--muted)", fontWeight:300, marginBottom:16 }}>{result.verdictLabel}</p>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:result.brandTags?.length ? 14 : 0 }}>
                <span style={{ fontSize:10, color:"var(--muted)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Confidence</span>
                <div style={{ flex:1, maxWidth:200 }}><ConfidenceMeter value={result.confidence || 0} /></div>
              </div>
              {result.brandTags?.length > 0 && (
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {result.brandTags.map((t,i) => <span key={i} style={{ fontSize:10, color:crVerdictColor(result.verdict), border:`1px solid ${crVerdictColor(result.verdict)}33`, padding:"2px 10px", letterSpacing:"0.1em", fontWeight:500 }}>{t}</span>)}
                </div>
              )}
            </div>

            {/* Item description */}
            {result.itemDescription && (
              <p style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic", fontWeight:300, marginBottom:16, paddingLeft:4 }}>{result.itemDescription}</p>
            )}

            {/* Signal bars */}
            {result.signals && (
              <div style={{ marginBottom:16 }}>
                <SignalRadar signals={result.signals} />
              </div>
            )}

            {/* Rationale */}
            {result.rationale && (
              <div style={{ padding:"20px 22px", background:"white", boxShadow:"var(--shadow)", marginBottom:10 }}>
                <Cap style={{ marginBottom:10, color:"var(--muted)" }}>What I see</Cap>
                <p style={{ fontSize:13, lineHeight:1.85, fontWeight:300, color:"var(--ink)" }}>{result.rationale}</p>
              </div>
            )}

            {/* Actionable guidance */}
            {result.actionableGuidance && (
              <div style={{ padding:"20px 22px", background:"white", boxShadow:"var(--shadow)", borderLeft:`3px solid ${crVerdictColor(result.verdict)}`, marginBottom:10 }}>
                <Cap style={{ marginBottom:10, color:crVerdictColor(result.verdict) }}>My recommendation</Cap>
                <p style={{ fontSize:13, lineHeight:1.85, fontWeight:400, color:"var(--ink)" }}>{result.actionableGuidance}</p>
              </div>
            )}

            {/* Occasion fit + gap analysis */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:24 }}>
              {result.occasionFit && (
                <div style={{ padding:"16px 18px", background:"var(--surface)", border:"1px solid var(--border)" }}>
                  <Cap style={{ marginBottom:6, fontSize:9, color:"var(--muted)" }}>Occasion fit</Cap>
                  <p style={{ fontSize:12, lineHeight:1.7, fontWeight:300, color:"var(--ink)" }}>{result.occasionFit}</p>
                </div>
              )}
              {result.gapAnalysis && (
                <div style={{ padding:"16px 18px", background:"var(--surface)", border:"1px solid var(--border)" }}>
                  <Cap style={{ marginBottom:6, fontSize:9, color:"var(--muted)" }}>Wardrobe gap</Cap>
                  <p style={{ fontSize:12, lineHeight:1.7, fontWeight:300, color:"var(--ink)" }}>{result.gapAnalysis}</p>
                </div>
              )}
            </div>

            {/* Decision buttons */}
            <div style={{ padding:"22px 24px", background:"var(--ink)", marginBottom:24 }}>
              <Cap style={{ color:"rgba(255,255,255,0.4)", marginBottom:14 }}>Your decision</Cap>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button onClick={() => { saveToConsidering("purchased"); setView("dashboard"); }}
                  style={{ background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", padding:"14px", cursor:"pointer" }}>
                  ✓ I'm Buying It
                </button>
                <button onClick={() => { saveToConsidering("pending"); setView("dashboard"); }}
                  style={{ background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.8)", border:"1px solid rgba(255,255,255,0.12)", fontFamily:"var(--sans)", fontSize:11, fontWeight:400, letterSpacing:"0.15em", textTransform:"uppercase", padding:"13px", cursor:"pointer" }}>
                  ⏱ Save to Considering ({crContext.urgencyHours}h window)
                </button>
                <button onClick={() => { saveToConsidering("rejected"); resetFlow(); }}
                  style={{ background:"none", color:"rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.08)", fontFamily:"var(--sans)", fontSize:11, fontWeight:300, letterSpacing:"0.15em", textTransform:"uppercase", padding:"12px", cursor:"pointer" }}>
                  ✕ Pass on This
                </button>
              </div>
            </div>

            <button onClick={resetFlow}
              style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer" }}>
              ← Assess another item
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────
  if (view === "dashboard") return (
    <div style={{ minHeight:"100vh", paddingTop:56 }}>
      <div style={{ padding:"16px 24px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:760, margin:"0 auto", paddingBottom:16, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <Cap style={{ marginBottom:5 }}>Change Room</Cap>
            <h2 style={{ fontFamily:"var(--serif)", fontSize:24, fontWeight:300 }}>Items You're Considering</h2>
          </div>
          <button onClick={() => setView("input")}
            style={{ background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:10, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", padding:"10px 20px", cursor:"pointer", whiteSpace:"nowrap" }}>
            + Validate Item
          </button>
        </div>
      </div>

      <div style={{ maxWidth:760, margin:"0 auto", padding:"28px 24px" }}>

        {/* Analytics strip */}
        {total > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28, animation:"fadeUp 0.4s ease both" }}>
            {[
              { label:"Total Considered", value:total, suffix:"" },
              { label:"On-Brand Rate", value:approvalRate, suffix:"%" },
              { label:"Purchase Rate", value:purchaseRate, suffix:"%" },
            ].map((s, i) => (
              <div key={i} style={{ padding:"18px 20px", background:"white", boxShadow:"var(--shadow)", textAlign:"center" }}>
                <p style={{ fontFamily:"var(--serif)", fontSize:28, fontWeight:300, color:"var(--ink)", lineHeight:1 }}>{s.value}{s.suffix}</p>
                <Cap style={{ color:"var(--muted)", marginTop:6, fontSize:9 }}>{s.label}</Cap>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:0, marginBottom:24, borderBottom:"1px solid var(--border)", overflowX:"auto" }}>
          {[
            { key:"all", label:"All" },
            { key:"pending", label:"Pending" },
            { key:"approved", label:"On Brand" },
            { key:"purchased", label:"Purchased" },
            { key:"rejected", label:"Rejected" },
            { key:"expired", label:"Expired" },
          ].map(f => (
            <button key={f.key} onClick={() => setDashFilter(f.key)}
              style={{ background:"none", border:"none", borderBottom:`2px solid ${dashFilter===f.key ? "var(--ink)" : "transparent"}`, color:dashFilter===f.key ? "var(--ink)" : "var(--muted)", fontFamily:"var(--sans)", fontSize:11, fontWeight:dashFilter===f.key?500:300, letterSpacing:"0.1em", textTransform:"uppercase", padding:"10px 14px", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s" }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Item cards */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 24px", animation:"fadeUp 0.4s ease both" }}>
            <p style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:300, marginBottom:10 }}>
              {considering.length === 0 ? "Nothing here yet." : "No items match this filter."}
            </p>
            <p style={{ fontSize:13, color:"var(--muted)", fontWeight:300, marginBottom:28 }}>
              {considering.length === 0 ? "Validate your first prospective purchase and it'll appear here." : "Try a different filter."}
            </p>
            {considering.length === 0 && (
              <button onClick={() => setView("input")}
                style={{ background:"var(--ink)", color:"var(--bg)", border:"none", fontFamily:"var(--sans)", fontSize:11, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", padding:"13px 28px", cursor:"pointer" }}>
                Validate a Purchase →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {filtered.map((item, i) => {
              const expired = item.expiresAt <= Date.now() && item.status === "pending";
              return (
                <div key={item.id}
                  style={{ background:"white", boxShadow:"var(--shadow)", borderLeft:`3px solid ${item.status==="purchased"?"var(--teal)":item.status==="rejected"?"var(--red)":crVerdictColor(item.verdict)}`, display:"flex", gap:0, animation:`fadeUp 0.35s ease ${i*0.05}s both`, opacity:item.status==="rejected"||expired?0.6:1, transition:"opacity 0.2s" }}>
                  {/* Image */}
                  {item.imagePreview && (
                    <div style={{ width:76, flexShrink:0, overflow:"hidden" }}>
                      <img src={item.imagePreview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    </div>
                  )}
                  {/* Content */}
                  <div style={{ flex:1, padding:"16px 20px", minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, gap:10 }}>
                      <p style={{ fontSize:13, fontWeight:400, color:"var(--ink)", lineHeight:1.4 }}>{item.productName}</p>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                        <span style={{ fontSize:10, color:item.status==="purchased"?"var(--green)":item.status==="rejected"?"var(--red)":crVerdictColor(item.verdict), fontWeight:500, whiteSpace:"nowrap" }}>
                          {item.status==="purchased" ? "✓ Purchased" : item.status==="rejected" ? "✕ Rejected" : item.verdict}
                        </span>
                        {item.status==="pending" && <CountdownBadge expiresAt={item.expiresAt} />}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                      {item.retailer && <span style={{ fontSize:11, color:"var(--muted)", fontWeight:300 }}>{item.retailer}</span>}
                      {item.price && <span style={{ fontSize:11, color:"var(--muted)", fontWeight:300 }}>·  {item.price}</span>}
                      {item.occasion && <span style={{ fontSize:11, color:"var(--muted)", fontWeight:300 }}>·  {item.occasion}</span>}
                    </div>
                    {item.brandTags?.length > 0 && (
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:8 }}>
                        {item.brandTags.slice(0,3).map((t,j) => <span key={j} style={{ fontSize:9, color:"var(--teal)", border:"1px solid rgba(29,158,117,0.2)", padding:"1px 8px", letterSpacing:"0.08em" }}>{t}</span>)}
                      </div>
                    )}
                    {/* Actions */}
                    {item.status === "pending" && (
                      <div style={{ display:"flex", gap:8, marginTop:12 }}>
                        <button onClick={() => updateItemStatus(item.id, "purchased")}
                          style={{ background:"var(--teal)", color:"white", border:"none", fontFamily:"var(--sans)", fontSize:9, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", padding:"6px 14px", cursor:"pointer" }}>
                          Bought It
                        </button>
                        <button onClick={() => updateItemStatus(item.id, "rejected")}
                          style={{ background:"none", color:"var(--muted)", border:"1px solid var(--border)", fontFamily:"var(--sans)", fontSize:9, fontWeight:400, letterSpacing:"0.12em", textTransform:"uppercase", padding:"6px 12px", cursor:"pointer" }}>
                          Pass
                        </button>
                        {expired && (
                          <button onClick={() => setConsidering(prev => prev.map(c => c.id===item.id ? { ...c, expiresAt:Date.now()+(24*3600000) } : c))}
                            style={{ background:"none", color:"var(--amber)", border:"1px solid rgba(176,106,32,0.2)", fontFamily:"var(--sans)", fontSize:9, fontWeight:400, letterSpacing:"0.12em", textTransform:"uppercase", padding:"6px 12px", cursor:"pointer" }}>
                            Extend 24h
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back to intro */}
        <div style={{ marginTop:32, paddingTop:20, borderTop:"1px solid var(--border)" }}>
          <button onClick={() => setView("intro")}
            style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--sans)", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer" }}>
            ← Back to Change Room
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]             = useState(SCREENS.HOME);
  const [stepInsights, setStepInsights] = useState({});
  const [stepMessages, setStepMessages] = useState({});
  const [brandDNA, setBrandDNA]         = useState("");
  const [blueprint, setBlueprint]       = useState(null);
  const [wardrobe, setWardrobe]         = useState([]);
  const [considering, setConsidering]   = useState([]);
  const [signature, setSignature]       = useState({});
  const [hydrated, setHydrated]         = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      const [dna, insights, msgs, wrd, sig, seen, cons, bp] = await Promise.all([
        sGet("dfine:brandDNA"),
        sGet("dfine:stepInsights"),
        sGet("dfine:stepMessages"),
        sGet("dfine:wardrobe"),
        sGet("dfine:signature"),
        sGet("dfine:onboardingSeen"),
        sGet("dfine:considering"),
        sGet("dfine:blueprint"),
      ]);
      if (dna)      setBrandDNA(dna);
      if (insights) setStepInsights(insights);
      if (msgs)     setStepMessages(msgs);
      if (wrd)      setWardrobe(wrd);
      if (sig)      setSignature(sig);
      if (cons)     setConsidering(cons);
      if (bp)       setBlueprint(bp);
      const hasProgress = (insights && Object.keys(insights).length > 0) || !!dna;
      if (!seen || !hasProgress) setShowOnboarding(true);
      setHydrated(true);
    })();
  }, []);

  useEffect(() => { if (hydrated) sSet("dfine:brandDNA",     brandDNA);     }, [brandDNA, hydrated]);
  useEffect(() => { if (hydrated) sSet("dfine:stepInsights", stepInsights); }, [stepInsights, hydrated]);
  useEffect(() => { if (hydrated) sSet("dfine:stepMessages", stepMessages); }, [stepMessages, hydrated]);
  useEffect(() => { if (hydrated) sSet("dfine:wardrobe",     wardrobe);     }, [wardrobe, hydrated]);
  useEffect(() => { if (hydrated) sSet("dfine:signature",    signature);    }, [signature, hydrated]);
  useEffect(() => { if (hydrated) sSet("dfine:considering",  considering);  }, [considering, hydrated]);
  useEffect(() => { if (hydrated) sSet("dfine:blueprint",    blueprint);    }, [blueprint, hydrated]);

  const completeOnboarding = () => {
    sSet("dfine:onboardingSeen", true);
    setShowOnboarding(false);
    setScreen(SCREENS.INDUCTION);
  };

  if (!hydrated) return (
    <>
      <GlobalStyles />
      <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:18, background:"var(--bg)" }}>
        <div style={{ width:40, height:40, borderRadius:"50%", border:"1.5px solid var(--bstrong)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:14, height:14, borderRadius:"50%", border:"1.5px solid var(--teal)", animation:"pulse 1.4s ease infinite" }} />
        </div>
        <p style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--muted)", fontFamily:"var(--sans)", fontWeight:400 }}>Restoring your profile…</p>
      </div>
    </>
  );

  if (showOnboarding) return (
    <>
      <GlobalStyles />
      <OnboardingScreen onComplete={completeOnboarding} />
    </>
  );

  return (
    <>
      <GlobalStyles />
      <Nav screen={screen} setScreen={setScreen} wardrobeCount={wardrobe.length} consideringCount={considering.length} hasDNA={!!brandDNA} hasBlueprint={!!(blueprint?.presenceStatement)} onShowOnboarding={() => setShowOnboarding(true)} />
      {screen===SCREENS.HOME        && <HomeScreen setScreen={setScreen} hasDNA={!!brandDNA} />}
      {screen===SCREENS.INDUCTION   && <InductionFlow onComplete={({ insights, dna, action }) => {
        if (insights) setStepInsights(prev => ({ ...prev, ...insights }));
        if (dna)      setBrandDNA(dna);
        setScreen(action==="blueprint" ? SCREENS.BLUEPRINT : action==="wardrobe" ? SCREENS.WARDROBE : SCREENS.BRAND);
      }} />}
      {screen===SCREENS.BRAND       && <BrandScreen stepInsights={stepInsights} setStepInsights={setStepInsights} stepMessages={stepMessages} setStepMessages={setStepMessages} brandDNA={brandDNA} setBrandDNA={setBrandDNA} />}
      {screen===SCREENS.BLUEPRINT   && <BlueprintScreen blueprint={blueprint} stepInsights={stepInsights} brandDNA={brandDNA} setBlueprint={setBlueprint} setScreen={setScreen} />}
      {screen===SCREENS.SIGNATURE   && <SignatureScreen brandDNA={brandDNA} signature={signature} setSignature={setSignature} setScreen={setScreen} />}
      {screen===SCREENS.ABOUT       && <AboutScreen brandDNA={brandDNA} />}
      {screen===SCREENS.WARDROBE    && <WardrobeScreen wardrobe={wardrobe} setWardrobe={setWardrobe} brandDNA={brandDNA} />}
      {screen===SCREENS.DRESS       && <DressScreen wardrobe={wardrobe} brandDNA={brandDNA} setScreen={setScreen} />}
      {screen===SCREENS.CHANGEROOM  && <ChangeRoomScreen brandDNA={brandDNA} considering={considering} setConsidering={setConsidering} />}
    </>
  );
}

