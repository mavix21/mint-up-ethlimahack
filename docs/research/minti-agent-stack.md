# Minti Agent Stack Research

Research snapshot: 2026-08-10

## Recommendation

Run Minti with `@convex-dev/agent` in the production Convex backend and use
Vercel AI Gateway as its AI SDK language-model provider. Keep this Next.js
application as the reactive chat and wallet-confirmation client.

Start with `openai/gpt-5-mini`. It currently offers the best documented balance
of tool-calling quality and price among Gateway models eligible for free-tier
credits. Validate it against `google/gemini-2.5-flash` and
`google/gemini-2.5-flash-lite` using a small application-specific evaluation
before locking the model.

Do not split one conversation between an AI SDK route in Next.js and a Convex
Agent. That creates two authorities for messages, streams, tool state, retries,
and approvals.

## Why Convex Agent Fits

The production Convex deployment already owns event discovery, authenticated
identity, inventory, purchase intents, and purchase reconciliation. Hosting the
agent there gives its tools direct access to narrow internal queries instead of
routing every tool call through Next.js and back to Convex.

Convex Agent adds capabilities that this product will otherwise need to build:

- persisted threads and ordered messages
- stored tool calls and results
- asynchronous database-backed streaming that survives client disconnects
- reactive updates to multiple clients
- persisted human approval requests
- agent debugging, usage tracking, and integration with Convex workflows

The component is built on AI SDK tools and model interfaces. It does not replace
AI SDK; it adds Convex-native persistence and orchestration around it. An AI
Gateway model can therefore be supplied to the Agent.

Because Convex actions do not run on Vercel, automatic Vercel OIDC
authentication is unavailable there. Store `AI_GATEWAY_API_KEY` in the Convex
deployment environment, never in the browser.

## Version Constraint

At this research snapshot:

- latest `@convex-dev/agent`: `0.6.4`
- its AI SDK peer requirement: `ai@^6.0.35`
- latest AI SDK: `7.0.59`
- `mint-up-prod/apps/admin` declares `ai@^7.0.37`
- `mint-up-prod/packages/backend` currently has no AI SDK or Agent dependency

The Agent stack should be pinned to compatible AI SDK 6 dependencies inside
`mint-up-prod/packages/backend`. The admin app can continue using AI SDK 7
because it is a separate workspace package. Do not pass AI SDK runtime objects
or types between those packages. Reassess this pin when Convex Agent publishes
AI SDK 7 compatibility.

## Model Choice

"Free tier" generally means a model can consume the team's monthly free AI
Gateway credits. It does not mean its normal token rate is zero. Free-tier
requests also have lower per-model rate limits, and buying Gateway credits moves
the team to the paid tier without the monthly free allocation.

Current normal rates:

| Model | Input / 1M | Output / 1M | Context | Tools | Recommendation |
| --- | ---: | ---: | ---: | --- | --- |
| `openai/gpt-5-mini` | $0.25 | $2.00 | 400K | Yes | Best default for constraint extraction, ranking, and tool use |
| `openai/gpt-4.1-mini` | $0.40 | $1.60 | ~1M | Yes | Strong schema baseline; slightly cheaper when output dominates |
| `google/gemini-2.5-flash` | $0.30 | $2.50 | 1M | Yes | Strong multilingual challenger |
| `google/gemini-2.5-flash-lite` | $0.10 | $0.40 | ~1M | Yes | Best low-cost challenger |
| `openai/gpt-4o-mini` | $0.15 | $0.60 | 128K | Yes | Mature inexpensive fallback |
| `inclusionai/ling-3.0-tiny-free` | Free shown | Free shown | 256K | Yes | Experimental only until tool/schema quality is measured |
| `poolside/laguna-s-2.1-free` | $0 | $0 | 256K | Yes | Coding-oriented; poor default fit for event concierge work |

At 10,000 input tokens and 1,500 output tokens, one `gpt-5-mini` model call is
about $0.0055 at normal rates. Tool loops require multiple model calls and repeat
some context, but $5 is still enough for hundreds of realistic evaluation turns
if prompts and tool results stay compact.

Model quality should be decided by an eval, not model branding. Build a fixture
set of English, Spanish, typo-heavy, ambiguous, and adversarial event requests.
Score:

- correct time-window and timezone interpretation
- budget and distance constraint adherence
- correct tool arguments
- no invented events or prices
- stable event IDs in rendered recommendations
- quality of ranking explanations
- latency and cost per completed request

## Production Backend Surfaces

Relevant backend paths in `mint-up-prod`:

- `packages/backend/convex/eventDiscovery.ts`: public faceted event discovery
- `packages/backend/convex/event/publicPage.ts`: detailed public event projection
- `packages/backend/convex/marketAreas.ts`: market lookup and search
- `packages/backend/convex/tables/events.ts`: event schema and search/index definitions
- `packages/backend/convex/eventPassPurchases.ts`: authenticated purchase preparation,
  submission, status, inventory, and idempotency checks
- `packages/backend/convex/eventPassPurchaseActions.ts`: internal onchain reconciliation
- `packages/backend/convex/convex.config.ts`: component registration

The current discovery API already accepts event format, platform, market,
category, community, price, start time, and end time filters. Minti's first
read-only tool should translate natural language into this existing filter
contract.

The event full-text index currently searches event names only and has no exposed
event search query. Initial Minti search should use deterministic facets. Add a
narrow backend search API later if free-text title or description search proves
necessary.

## Tool Boundaries

Start with one compact read-only tool:

`searchEvents`

- Inputs: time range, market area, format, categories, price ceiling, result limit
- Output: stable event ID, title, times, timezone, location, compact distance data,
  price projection, availability, image, canonical URL
- Behavior: returns only public event projections and never arbitrary documents

Add a separate detail tool only when needed:

`getEventOffer`

- Input: stable event ID
- Output: authoritative ticket/pass options, current price, sale window, inventory,
  and purchase eligibility

Do not expose `eventPassPurchases.prepare` directly as an automatic LLM tool.
Later, Minti may propose a typed purchase intent, but financial execution needs
two deterministic gates:

1. Explicit approval in the conversation.
2. Browser passkey or wallet confirmation through the existing purchase flow.

The model must never invent the event ID, amount, recipient, chain, availability,
or quote expiry. Those values come from Convex. Conversational approval is not a
blockchain signature.

## Client Boundary

The Next.js app should receive reactive thread messages from Convex through a
narrow client component. The route, event card rendering, and surrounding chat
layout can remain Server Components. The interactive island owns:

- `useUIMessages` subscription and streamed deltas
- composer state and send mutation
- rendering typed tool parts
- approval controls
- purchase/passkey confirmation controls

The hackathon frontend already interfaces with the production Convex project,
but authenticated Minti threads require its origin to be allowed by the existing
Better Auth trusted-origin configuration.

## Delivery Order

1. Install Convex Agent and compatible AI SDK 6 dependencies in the production
   backend; register the component.
2. Add authenticated thread ownership, message listing, and persisted delta
   streaming.
3. Add the read-only `searchEvents` tool over existing discovery filters.
4. Connect this chat shell through a narrow Convex client island.
5. Run the model evaluation and choose the default/fallback model.
6. Add event details and deterministic recommendation-card tool parts.
7. Add approval-required purchase intents, keeping passkey authorization in the
   browser and purchase state in existing Convex workflows.

## Sources

- [Vercel AI Gateway free-tier model browser](https://vercel.com/ai-gateway/models?modality=text&freeTier=true)
- [Vercel AI Gateway model API](https://ai-gateway.vercel.sh/v1/models)
- [Vercel AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing)
- [AI SDK AI Gateway provider](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [Convex Agent overview](https://docs.convex.dev/agents)
- [Convex Agent getting started](https://docs.convex.dev/agents/getting-started)
- [Convex Agent tools](https://docs.convex.dev/agents/tools)
- [Convex Agent streaming](https://docs.convex.dev/agents/streaming)
- [Convex Agent tool approval](https://docs.convex.dev/agents/tool-approval)
- [npm: `@convex-dev/agent`](https://www.npmjs.com/package/@convex-dev/agent)
