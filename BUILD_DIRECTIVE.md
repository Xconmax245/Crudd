# CRUDD — Master Build Directive (v2)

**Purpose of this document:** This is the single source of truth for building CRUDD. It is written for an AI build agent executing the implementation. Every architectural decision below has been explicitly locked by the product owner. Where something is marked "OPEN," do not silently resolve it — surface it before building the affected part.

> **v2 changes:** This revision (a) adopts the **design system extracted from the provided reference design code** as CRUDD's UI foundation, (b) defines a **GOOFY brand identity + easy-UX** layer on top of that system, and (c) sequences a **Landing Page as Phase 0 — built and shipped before the main app**. Product/architecture decisions from v1 remain locked and unchanged.
>
> **v3 amendment (Phase 0 sign-off):** The Phase 0 landing page was **intentionally implemented as a React 19 + Vite + TypeScript + Tailwind CSS application** (not the vanilla HTML/CSS/JS artifact originally implied by §14). This supersedes the "no build step / openable directly in a browser" description. The full locked stack is documented in the companion tech-stack document and is the single source of truth for all phases. All content audited against MVP scope and locked before Phase 1.

---

## 0. Build Phasing — READ FIRST

The build is sequenced. Do not start Phase 1 until Phase 0 is delivered and approved.

| Phase | Deliverable | Status |
|---|---|---|
| **Phase 0 — Landing Page** | `apps/landing/` — React + Vite + TypeScript + Tailwind marketing page. Sells the product, explains the loop, drives to "Start a Challenge / Join a Match". | ✅ Delivered & audited |
| **Phase 1 — Core App Shell** | Browse page (bank grid) → Configure screen → Challenge creation + share link. Postgres schema. | After Phase 0 |
| **Phase 2 — Real-Time Match** | Lobby → WebSocket match engine → live leaderboard → results. Redis live state. | After Phase 1 |
| **Phase 3 — Admin + Polish** | Admin bank seeding, tuning scoring curve, analytics. | After Phase 2 |

**The Landing Page (Phase 0) is a marketing artifact, not the app.** It shares the design system and voice with the app but has no game logic. Its only job: communicate the identity (§1), make the loop obvious, and convert to a first challenge.

---

## 1. Product Definition

**CRUDD** is a real-time competitive quiz/challenge platform. A user turns a question bank into a timed multiplayer match, shares a link, and up to 10 people compete answering the same questions simultaneously. Speed and correctness determine score; a live leaderboard tracks standings; a final results screen declares a winner.

**Core loop:** Create a challenge → share the link → friends join → questions appear → answer as fast as possible → earn points → compete on the leaderboard → determine a winner → rematch.

**Identity — read this before building any UI copy or flow:**
CRUDD must NOT feel like a study app or LMS. It should never present itself as "here is a website where you study." It should feel like *"I have questions — let's see who actually knows this."* The educational content is real, but the product experience is a **competitive game**. Every UI decision (copy, pacing, visual hierarchy) should be evaluated against this identity.

**Tone lock (v2): the identity is expressed as GOOFY — see §13.** Loud, playful, a little chaotic, trash-talky in a friendly way. Think game-show energy, not classroom. This applies to the landing page and the app.

**One-sentence spec:** CRUDD is a real-time multiplayer quiz platform where users turn question banks into timed competitive challenges and invite up to 10 friends through a shareable link, with correctness, speed, and live rankings determining who wins.

---

## 2. Mental Model — Three Layers

This separation is foundational. Do not collapse these into one entity.

```
QUESTION BANK  (persistent content, admin-owned)
      │  generates
      ▼
CHALLENGE      (a configured match instance — settings + randomized question set + link)
      │  launches
      ▼
LIVE MATCH     (ephemeral real-time session — players, timer, answers, live scores)
```

- **Question Bank** — durable, reusable. Exists independently of any match.
- **Challenge** — a specific configured instance generated from a bank (question count, timer, player cap, the randomized subset+order of questions, a unique share link). One bank can generate infinite challenges.
- **Match** — the live, ephemeral real-time session that runs once a challenge's lobby starts. Not replayed; once finished, immutable.

---

## 3. MVP Scope — Build This, Nothing More

### In scope
- Admin uploads/creates question banks (see §4 — **regular users cannot create banks at launch**)
- Browse page: grid of question bank cards, each showing title + question count
- Tap a bank → configure screen (question count, players, timer — see §5)
- Generate unique challenge link, copy-to-share
- Guest join via link (username only, no account required)
- Lobby (player list, host indicator, start control)
- Live match: synchronized question delivery, timed answering, server-authoritative scoring
- Live leaderboard, updating after every question
- Final results screen (winner, standings, basic stats)
- **Landing page (Phase 0)** — marketing entry point

### Explicitly OUT of MVP scope (do not build)
- User-created question banks
- Power-ups (double points, 50/50, time freeze, shield, second chance)
- Public/private bank visibility controls
- Classrooms / recurring or daily challenges
- Global or subject-specific rankings
- Achievements
- Match history / replay
- AI-generated questions from PDFs/notes
- Spectator mode (host who doesn't occupy a player slot)
- Custom timer values beyond the defined presets

---

## 4. Question Banks

- Admin-only creation/upload at launch. There is no end-user "create a bank" flow in MVP — this is explicitly deferred.
- A bank has: title, subject, and a set of questions.
- Each question has, at minimum: question text, multiple-choice options, correct answer.
- Metadata fields (difficulty, tags, explanation, source) are schema-optional — include the columns but do not build UI for them in MVP.
- Import tooling (CSV/JSON) is an admin-side convenience, not a player-facing feature. Not required for MVP if the admin can seed banks directly via the database/dashboard — **confirm with product owner before building import UI.**

**Browse page requirement:** each bank card must display its question count (this directly affects what the configure screen can offer per §5). *(The landing page mirrors this with an illustrative bank-card grid — see §14.)*

---

## 5. Challenge Configuration — Locked Rules

Finalized, non-negotiable rule set. Do not add derivation logic beyond what's specified here.

| Setting | Source | Rule |
|---|---|---|
| **Question count** | Derived from the selected bank | `maxQuestions = bankSize`. No global cap. No bank-size tiers or special cases. Presets dynamically generated from `bankSize` (e.g. bank of 50 → 10/20/25/30/40/50). Custom numeric input allowed but validated `1 ≤ n ≤ bankSize`. |
| **Players** | Independent — platform constant | Max 10 total participants **including the host** (see §6). Not derived from the bank. |
| **Timer (per question)** | Independent — match setting | Default 10s. Presets: 5 / 10 / 15 / 20 / 30 seconds. No custom timer value in MVP. |

**Do not couple players or timer to the question bank.** Only question count derives from bank size.

---

## 6. Host / Participant Model — Locked

- The host is **not** a separate entity. The host is a `MatchParticipant` with `role: HOST`; everyone else is `role: PLAYER`.
- The host **participates as a player by default** and occupies one of the 10 slots. No spectator mode in MVP.
- Max 10 total participants, host included.
- Host has elevated permissions: owns the challenge, can start the match.
- **Host leaves before match starts:** ownership transfers to another participant (preferred), or lobby closes if no valid target. Build toward transfer.
- **Host leaves during active match:** match continues unaffected.
- Keep `role` as an extensible enum for future spectator mode; do not build spectator scaffolding now.

**Participant shape:**
```
MatchParticipant
├── id
├── challengeId (fk)
├── sessionId / userId
├── username
├── role: HOST | PLAYER
├── score
├── joinedAt
└── leftAt
```

---

## 7. User Flow (End to End)

0. **Land** — user hits the **landing page**, gets the pitch, taps "Start a Challenge" (→ Browse) or "Join a Match" (paste link / enter code).
1. **Browse** — page of question bank cards (e.g. "Biology — 45 questions"). No login to browse.
2. **Select** — tap a card.
3. **Configure** — set question count (bounded per §5), players, timer.
4. **Create** — CRUDD generates a `Challenge` with a locked, randomized question subset+order and a unique share link.
5. **Share** — copy-link action; designed for WhatsApp/Discord/Telegram group chats.
6. **Join** — each participant opens the link, enters a username (guest), lands in the lobby.
7. **Lobby** — challenge/bank title, player list with host indicator, `x/10 players`, host-only Start control.
8. **Match start** — countdown (3-2-1-Go), then synchronized question delivery.
9. **Per question:** all players get the same question at the same time; timer runs off server timestamps; players submit; server resolves correctness, timing, points; brief round results; leaderboard updates; advance.
10. **Final results** — winner declared, final standings, basic stats (accuracy, avg response time). Actions: Play Again / Challenge Friends / Return Home.

---

## 8. Real-Time Architecture

CRUDD is not a simple REST CRUD app — it requires persistent real-time communication for match play. **Do not build the match experience on polling.**

**Stack:**
- Frontend: React + TypeScript + Vite (or Next.js) + Tailwind — **styled per the design system in §12/§13.**
- Backend: Node.js + TypeScript + WebSocket layer (Socket.IO recommended)
- Persistent storage: PostgreSQL
- Ephemeral/live state: Redis (current question, timers, per-question answer sets, pub/sub for scaling)

**Non-negotiable architectural rules:**
1. **Server authoritative for everything time- and score-related.** Never trust client-reported timestamp, score, or "I answered first."
2. **Clients render server-broadcast state only.** Broadcast `questionStartedAt` / `questionEndsAt`; clients compute local countdown display from those, deadline enforced server-side. No client-driven "10s passed, advance."
3. **Never send the correct answer to the client before a question resolves.** Open payload = question text + options only. Reveal answer only after close, with results.
4. **One answer per player per question**, enforced server-side. Reject duplicates.
5. **Reject answers when:** match not started, question already ended, player not a valid participant, player already answered, or match finished.
6. **Deterministic ordering for near-simultaneous submissions** — use server-received ms timestamp as ordering key; never client-sent timestamps.

---

## 9. Match State Machine

```
WAITING → STARTING (countdown) → ACTIVE (question open) → RESULTS (question resolved)
   → [ next question: back to ACTIVE ] → ... → FINISHED
```
`CANCELLED` is a valid terminal state if the host closes the lobby before start.

The server owns this state machine exclusively. Clients are dumb renderers — never infer transitions client-side.

---

## 10. Scoring

- **Correctness first, speed second.** A correct answer always beats an incorrect one; among correct answers, faster earns more.
- Wrong or no answer before deadline = 0 points.
- Everyone correct earns points — not winner-take-all. Fastest correct earns most; slower correct earn progressively less.
- Exact formula is **OPEN** — implement as a swappable function `calculateScore(isCorrect, responseMs, deadlineMs)`. Placeholder bracket:

| Response time | Points (if correct) |
|---|---|
| < 1s | 200 |
| 1–2s | 180 |
| 2–4s | 160 |
| 4–6s | 140 |
| 6–8s | 120 |
| 8–10s | 100 |
| Wrong / no answer | 0 |

Placeholders pending final tuning, not a committed spec.

---

## 11. Data Model (PostgreSQL)

```sql
question_banks
  id, title, subject, created_by, created_at

questions
  id, bank_id (fk), question_text, options (jsonb array),
  correct_index, created_at
  -- optional/schema-only for MVP: difficulty, tags, explanation, source

challenges
  id, bank_id (fk), created_by,
  question_count, timer_seconds, max_players,
  status (LOBBY | ACTIVE | FINISHED | CANCELLED),
  share_slug (unique),
  created_at

challenge_questions
  id, challenge_id (fk), question_id (fk), position,
  shuffled_options (jsonb)

match_participants
  id, challenge_id (fk), session_id, username,
  role (HOST | PLAYER), score, joined_at, left_at

match_answers
  id, challenge_id (fk), question_id (fk), participant_id (fk),
  selected_index, is_correct, response_ms, points_awarded, answered_at
```

**Key notes:**
- `challenge_questions` locks the randomized set **and order** at creation — every player sees the identical sequence. Do not re-randomize per player.
- Option order (`shuffled_options`) randomized per challenge, independent of question order.
- Live scoring lives in Redis; `match_answers` is the durable write-behind log, flushed per question (or batched at match end).
- `challenges.status` tracks high-level lifecycle; granular real-time state (§9) lives in Redis while live.

---

## 12. Design System — Adopted From Reference Design Code

The provided reference design code (a Webflow-style B2B site) is CRUDD's **structural + naming foundation**. We keep its clean, well-organized system and re-skin it goofy (§13). Adhere to these conventions across landing page and app.

### 12.1 Naming convention
Client-First / BEM-ish: `block_element` for components, standalone **modifier/utility classes** stacked alongside (e.g. `class="section-padding is-large padding-bottom-0"`).

### 12.2 Layout utilities (locked class names)
| Class | Role |
|---|---|
| `container` / `container-large` | Centered max-width wrapper (~1200 / ~1300px). |
| `padding-global` | Horizontal page gutter (responsive clamp). |
| `section-padding` + `is-hero` / `is-large` | Vertical section rhythm. |
| `padding-top-0` / `padding-bottom-0` | Kill a side of section padding. |
| `grid-2-col` | Two-column responsive grid (collapses to 1 on mobile). |
| `section-title` + `title-gap` | Section heading block; `align-center` / `text-align-center` variants. |
| `max-width-40` / `-60` / `-80` | Constrain text-block width. |
| `opacity-70` / `opacity-50` | Stepped emphasis. |

### 12.3 Typography scale (locked class names)
`heading-1` … `heading-6`, `text-body-large`, `text-body-medium`, `text-body-small`, `text-subheadline` (uppercase eyebrow), `text-accent` (accent-color inline text).

### 12.4 Component inventory (reuse these blocks/names)
- **Nav:** `nav_component`, `nav_logo`, `nav_menu`, `nav_list`, `nav_link`, `nav_hamburger`(+`-line`), `nav_dropdown`(+`-link`).
- **Buttons:** `btn-primary` (+`btn-primary_side-text`), `btn-secondary`.
- **Hero:** `hero`, `hero_content`, `hero_text-group`, `hero_heading` (+`-highlight`/`-circle`), `hero_body`, `hero_cta-group`, `hero_bullets`/`hero_bullet`(+`-icon`/`-text`), `hero_logobar`/`hero_logo-wrapper`.
- **Problem/Solution:** `card-problem`, `card-solution`, `ps-card_header`, `ps-card_title`, `ps-card_subtitle`, `ps-card_list`, `ps-card_item`, `ps-icon`(+`--problem`/`--solution`), `ps-card_text`, `ps-card_emphasis`, `ps-divider`, `ps-cta`.
- **Works/Showcase:** `works_*` (list, project, image-wrapper, stats-overlay, stat, details, info, title-row, description, improvements, services, testimonial, quote, author, avatar). `tag`, `works_highlight` (mark).
- **Marquee:** `redesigns_marquee-wrapper`, `redesigns_marquee-track`, `redesigns_card`, `redesigns_image`.
- **Process/Steps:** `process_list`, `process_rule`, `process_week`, `process_badge`, `process_content`, `process_checklist`, `process_check-item`, `process_check-icon`.
- **Testimonials:** `testimonials_grid`, `testimonial_card`, `testimonial_author`(+`-info`), `testimonial_avatar`(+`-wrap`), `testimonial_name`, `testimonial_role`, `testimonial_stars`, `testimonial_quote`.
- **Pricing:** `pricing_card`, `pricing_left/right`, `pricing_info`, `pricing_description`, `pricing_price`(+`_from/_amount/_period`), `pricing_cta`, `pricing_divider`, `pricing_features-grid`, `pricing_feature-group/label/list/item`, `pricing_check-icon`.
- **FAQ:** `faq_list`, `faq_item`, `faq_header`, `faq_question`, `faq_icon`, `faq_answer`, `faq_footer`, `faq_link`.
- **CTA/Booking:** `booking`, `booking_embed`, `booking_availability`.
- **Footer:** `footer`, `footer_inner`, `footer_top`, `footer_brand`, `footer_logo(-link)`, `footer_tagline`, `footer_nav-group/col/label/links/link`, `footer_rule`, `footer_bottom`, `footer_copyright(-wrap)`, `footer_legal-links/link/divider`, `footer_socials`, `footer_social-btn/icon`.

### 12.5 Asset rule
The reference code references external image/logo/icon assets that are not shipped. **Phase 0 must be self-contained: use inline SVG, CSS shapes, and emoji instead of external image files** so the page opens with zero broken dependencies. Real brand/logo assets are a later concern.

---

## 13. GOOFY Brand Identity + Easy-UX Layer

CRUDD's skin over the §12 structure. Goal: **maximally playful, minimally confusing.** Goofy in look/voice; dead-simple in navigation.

### 13.1 Visual language — "Playful Neo-Brutalist"
- **Chunky:** thick `3px` black borders, hard offset shadows (`6px 6px 0 #16161D`), fat rounded corners.
- **Loud color:** cream paper base + a candy palette (purple, hot pink, lime, cyan, yellow, orange). Blocks of flat color, no timid gradients.
- **Rounded goofy type:** display font **Fredoka** (headings), friendly body font **Nunito**.
- **Sticker energy:** rotated badges, googly-eye accents, emoji as graphics, wobbly hover animations, bouncy CTAs, a little brain/blob mascot.
- **Motion:** wobble/bounce/float micro-animations; a scrolling marquee. **Respect `prefers-reduced-motion`** — disable non-essential motion.

### 13.2 Design tokens (implement as CSS variables)
```
--cream:#FFF4E0  --ink:#16161D  --white:#FFFFFF
--purple:#7C5CFC --pink:#FF5CA8 --lime:#C6F135
--cyan:#34D6E8   --yellow:#FFD23F --orange:#FF8A3D
--border:3px solid var(--ink)
--shadow-sm:3px 3px 0 var(--ink)  --shadow:6px 6px 0 var(--ink)  --shadow-lg:10px 10px 0 var(--ink)
--radius:18px --radius-lg:28px --radius-pill:999px
```

### 13.3 Voice & copy
- Game-show announcer, not teacher. Short, punchy, cocky-friendly.
- Examples: "You THINK you know it. Prove it." / "Loser buys coffee." / "10 friends. 1 winner. 0 mercy." / "No studying. Just flexing."
- Emojis welcome in marketing; keep them out of the live-question UI (§13.5).

### 13.4 Easy-UX rules (non-negotiable)
- One primary action per screen, huge and obvious.
- Big tap targets (min 44px), mobile-first — links open from chat apps on phones.
- Sticky nav on landing; smooth in-page scroll; visible focus states.
- No dead ends: every screen offers an obvious next step.
- Accessibility: semantic HTML, `aria-expanded` on toggles, alt text / `aria-hidden` on decorative art, keyboard operable.

### 13.5 In-match exception (from v1 §13, still locked)
During an active question: **minimal chrome.** Hierarchy is **question → timer → answer options → current score/position.** No goofy clutter competing mid-question. Goofiness lives in lobby, transitions, results, and marketing — never on top of a live question.

---

## 14. Landing Page Spec (Phase 0)

Static, self-contained, mobile-first. Section order (mapped to §12 blocks, re-skinned per §13):

1. **Nav** — logo, links (How it works / Question Banks / FAQ), primary CTA "Start a Challenge".
2. **Hero** — big goofy headline + subhead explaining the loop; dual CTA ("Start a Challenge" / "Join a Match"); trust bullets; mascot + floating stickers.
3. **Trust strip** — goofy stats / "as seen in group chats everywhere" marquee-ish logo bar (text/emoji, no image deps).
4. **Boring vs CRUDD** — problem/solution two-card block (`card-problem` = normal quizzes 😴 / `card-solution` = CRUDD 🔥).
5. **How it works** — 4 steps (Browse → Configure → Share → Compete) using the `process_*` block.
6. **Live match preview** — a fake, styled leaderboard + timer + points to show the vibe.
7. **Question banks** — illustrative bank-card grid (title + question count per §4 requirement).
8. **Testimonials** — goofy quotes grid (`testimonial_*`).
9. **FAQ** — accordion (`faq_*`), keyboard + `aria-expanded`.
10. **Final CTA** — big "Ready to settle this?" block.
11. **Footer** — brand, nav columns, socials, year.

**Interactivity (vanilla JS):** mobile hamburger toggle, FAQ accordion, dynamic year, smooth scroll, playful hover/confetti flourish (motion-reduced-safe). No backend, no build step required — openable directly in a browser.

---

## 15. UI/UX Principles (app, carried from v1)
- Active question: minimal chrome (see §13.5).
- Mobile first everywhere.
- Leaderboard updates after every question to sustain tension.
- Final results reads as a **game-over screen**, not a report: winner callout, standings, then secondary stats.

---

## 16. Explicitly Open Decisions (surface before building the affected piece)
- Exact scoring formula/curve (placeholder in §10).
- Whether persistent accounts are needed in MVP or fully post-MVP.
- Question import format(s) / whether import UI is needed for MVP or DB-seeding suffices.
- Final tagline / brand wordmark beyond "CRUDD" (landing page uses working goofy taglines).
- Exact final color hexes / mascot design (tokens in §13.2 are the working set).

Everything else is locked. Implementation details not covered here are the build agent's discretion — but flag anything that would materially affect the data model or the real-time protocol before committing.
