---
name: poc-planner
description: >
  Translate architecture documents, HLD specs, UI specifications, and PRDs into a focused, implementation-ready POC execution plan. Use this skill whenever the user provides system design documents, feature specs, wireframes, or product requirement docs and wants to scope them down into a buildable proof-of-concept. Trigger on mentions of "POC", "prototype", "proof of concept", "scope down", "minimal build", "validate the concept", "MVP scope", or any request to convert full specs into a reduced prototype plan. Also trigger when a user uploads an HLD, architecture diagram, UI spec, or PRD and asks what to build first, what the minimum viable demo looks like, or how to validate the core idea with minimal engineering effort. This skill is frontend-first and assumes no or limited backend — it produces mock data contracts instead of real API designs. The output is a structured Markdown document directly consumable by AI coding assistants like Cursor, Copilot, or Claude Code.
---

# POC Planner

Turn full-system specifications into focused, buildable proof-of-concept plans.

## Why this skill exists

Teams frequently have detailed architecture docs, HLDs, or UI specs that describe a complete system — but what they actually need first is a small, demoable prototype that validates the core idea. The gap between "here's the full vision" and "here's what to build this week" is where most POC efforts stall. This skill bridges that gap by systematically reducing scope while preserving the critical user flows that prove the concept works.

The guiding principle: **a POC validates vision, not completeness.** Every decision in the plan should serve that goal.

## How to use this skill

### Step 1: Ingest the source material

Read whatever the user has provided — HLD, architecture doc, UI spec, PRD, wireframes, or even a conversational description of their system. Look for:

- **Product vision**: What problem does this solve? Who is it for?
- **Core user flows**: What are the 2–4 journeys that demonstrate the product's value?
- **System components**: Frontend screens, backend services, integrations, data stores
- **UI details**: Screen layouts, navigation patterns, interaction behaviors
- **Technical constraints**: Platform, framework preferences, existing infrastructure

If the source material is ambiguous or incomplete, note gaps as Open Questions in the output rather than guessing. Ask the user to clarify only if a gap would fundamentally change the POC scope (e.g., you can't tell what the product does).

### Step 2: Identify the validation core

This is the most important analytical step. Ask yourself:

- **What is the single most important thing this POC needs to prove?** (e.g., "users can complete the onboarding flow intuitively", "the dashboard layout communicates the right data at a glance")
- **Which user flows, if demoed successfully, would convince a stakeholder that the concept works?**
- **What can be faked, stubbed, or deferred without undermining that proof?**

The validation core typically involves 2–4 user flows. Resist the temptation to include more — a POC that tries to validate everything validates nothing.

### Step 3: Draw the scope boundary

Categorize every feature and component from the source material:

**In Scope** — Things the POC must include to validate the core concept:
- Primary user flows (the ones identified in Step 2)
- Screens those flows touch
- Interactions that are central to the UX hypothesis
- Enough visual fidelity to evaluate the experience (not pixel-perfect, but not wireframes either)

**Out of Scope** — Things to explicitly defer:
- Backend infrastructure (replace with mock data)
- Authentication and authorization (hardcode a logged-in state)
- Edge cases that don't affect the core flow
- Admin panels, settings screens, secondary features
- Performance optimization
- Error handling beyond basic states

Be specific when listing out-of-scope items. "Backend" is too vague — say "User authentication (hardcoded logged-in state), real database persistence (using local state/mock JSON), third-party integrations (simulated responses)." This prevents scope creep by making the boundaries explicit.

### Step 4: Review checkpoint — validate with the user before proceeding

Do NOT jump straight to the full document. Present a concise summary for the user to review and approve first. This catches misaligned priorities early and avoids rework.

**What to present:**

1. **POC Objective** — one sentence stating what the POC will validate and for whom
2. **Validation core** — the 2–4 user flows you identified as critical, each as a one-liner (e.g., "Flow 1: New user completes onboarding and sees their first dashboard")
3. **Scope boundary** — a short bulleted list of what's in and what's explicitly out, focusing on the decisions most likely to be controversial (the stuff that's borderline)
4. **Key assumptions** — anything you treated as true that might be wrong

**How to present it:**

Keep it short — ideally fits on one screen. Frame it as "Here's what I'm planning to include in the full POC plan — does this look right, or should I adjust anything?" Be specific about what kind of feedback you need: Are the right flows prioritized? Is anything missing from scope? Are the assumptions valid?

**Wait for the user's response.** They may:
- **Approve as-is** → proceed to Step 5
- **Adjust scope** → add/remove flows or features, then re-present the updated summary
- **Redirect entirely** → the validation core was wrong; go back to Step 2 with new understanding
- **Ask clarifying questions** → answer them, update the summary if needed, and re-present

Do not generate the full document until the user has explicitly confirmed the direction. A quick "looks good" or "go ahead" is sufficient — you don't need a formal sign-off. But silence or ambiguity means ask again.

### Step 5: Generate the POC plan document

Produce a Markdown document with the following structure. Every section matters — don't skip any, even if a section is short.

---

## Output Document Structure

````markdown
# POC Plan: [Product/Feature Name]

## 1. POC Objective
One paragraph. State what the POC will validate and for whom. Be specific about
what "success" looks like — e.g., "Demonstrate that the 3-step booking flow feels
intuitive to first-time users" not "Build a booking prototype."

## 2. Scope Definition

### In Scope
- Bulleted list of features, flows, and screens included
- Each item should be concrete enough to estimate
- Group by flow or feature area if there are more than 6 items

### Out of Scope
- Bulleted list of explicitly deferred items
- For each, note in parentheses how it's handled in the POC
  e.g., "User auth (hardcoded as logged-in)" or "Payment processing (success stub)"

## 3. User Flows to Validate
For each flow (typically 2–4):

### Flow: [Flow Name]
**Goal**: What the user is trying to accomplish
**Entry point**: Where the flow starts
**Steps**:
1. Step-by-step walkthrough of the happy path
2. Include screen transitions
3. Note key decision points

**Success indicator**: How you know this flow "works" in a demo

## 4. Screen / UI Breakdown
For each screen the POC includes:

### [Screen Name]
- **Purpose**: What this screen does in the flow
- **Key elements**: List the UI components that must be present
- **State variations**: What states this screen can be in (empty, loaded, error, etc.)
- **Navigation**: Where the user comes from and where they go next

## 5. Component Hierarchy
A tree showing how UI components nest. This helps an AI coding assistant scaffold
the project structure. Use indentation to show nesting:

- App
  - Layout
    - Sidebar
      - NavItem
    - MainContent
      - [Screen components...]

Include only components specific to this POC, not generic primitives (buttons, inputs).

## 6. Mock Data Contracts
For each data entity the POC needs, provide a sample JSON object. These simulate
what the backend would return. Include realistic sample values, not lorem ipsum.

### [Entity Name]
Purpose: [What this data represents]

```json
{
  "id": "usr_01",
  "name": "Priya Sharma",
  "role": "project_manager",
  ...
}
```
Notes: [Any assumptions about the data shape, pagination, etc.]

## 7. Key Interactions & Behaviors
Describe non-obvious interaction patterns — things an AI coding assistant wouldn't
infer from the screen breakdown alone:

- **State transitions**: What triggers a screen or component to change state?
  Document as: `[trigger] → [from state] → [to state]`
- **Conditional rendering**: When do certain UI elements appear/disappear?
- **Animations / transitions**: Any motion that's important to the UX feel
- **Simulated async**: Where should fake loading states appear to feel realistic?

## 8. Assumptions
Bulleted list of assumptions baked into this plan. These are things you treated as
true but haven't verified. Examples:
- "Users will access this on desktop browsers (no mobile layout needed)"
- "The dashboard refreshes on navigation, not via real-time push"

## 9. Open Questions / Unknowns
Bulleted list of things that need answers before or during build. Flag who should
answer them (design, product, engineering). Examples:
- "Does the filter panel persist selections across screens?" → Ask: Design
- "Is the notification count real-time or polled?" → Defer: Out of POC scope

## 10. Demo Narrative
A short script (5–8 sentences) describing how to walk a stakeholder through
the finished POC. This helps the builder understand the "story" the prototype
needs to tell.

"We open the app and see [X]. The user clicks [Y], which takes them to [Z].
Notice how [key UX insight]. Then they complete [flow] by [action]. This
demonstrates that [core value proposition]."
````

---

## Quality checklist

Before delivering the plan, verify:

- [ ] Every in-scope item traces back to a user flow in Section 3
- [ ] No screen is mentioned that isn't in a user flow
- [ ] Mock data contracts cover every entity referenced in the screens
- [ ] The component hierarchy matches the screen breakdown
- [ ] Out-of-scope items explain how they're handled (stubbed, hardcoded, hidden)
- [ ] The demo narrative is a coherent walkthrough, not a feature list
- [ ] Open questions are specific and assigned (not vague "TBD" items)

## Tone and style of the output

- **Concise but complete** — every section should be scannable. Use bullets and short paragraphs. No filler.
- **Implementation-oriented** — write as if the next reader is an AI coding assistant that will scaffold the project from this document. Be precise about component names, data shapes, and state transitions.
- **Opinionated where possible** — if the source material is ambiguous, make a reasonable decision and note it as an assumption. A plan full of "TBD" items isn't useful.
- **Validation-focused** — if you catch yourself including something that doesn't serve the POC's validation goal, move it to Out of Scope.

## Handling different input quality

**Rich input** (detailed HLD + UI specs): Follow the full process above. You'll have enough information to produce a thorough plan.

**Moderate input** (PRD or feature description without detailed UI): You'll need to infer screen layouts and component structure. Make reasonable assumptions, document them, and flag areas where the user should provide more detail.

**Sparse input** (a paragraph or conversation about the idea): Focus on extracting the validation core (Step 2). The plan will have more Open Questions and Assumptions, and the Screen/UI Breakdown will be higher-level. That's fine — a rough POC plan is better than no plan.

## Common traps to avoid

- **Scope creep via "while we're at it"** — if a feature isn't in a validated user flow, it doesn't belong in the POC. Period.
- **Mock data that's too simple** — use realistic sample data with realistic field names and values. `{ "name": "test" }` tells a coding assistant nothing; `{ "name": "Priya Sharma", "role": "project_manager", "activeProjects": 3 }` tells it everything.
- **Missing state transitions** — screens don't just exist in their "loaded with data" state. Empty states, loading states, and the one critical error state should be in the plan.
- **Forgetting the demo narrative** — the POC exists to be shown to someone. If you can't describe the demo, the POC doesn't have a clear story.
