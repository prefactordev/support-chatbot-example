# Prefactor Chatbot Demo

This repository is a small SvelteKit support chatbot that shows Prefactor in a realistic application. Clone it, add your deployment keys, start the server, and chat with the demo to see agent activity appear in Prefactor.

The example has two agent roles:

- A primary agent that handles the conversation.
- One support agent that completes background investigations for billing, access, account, and security questions.

The support deployment is optional. Without it, investigations use the primary Prefactor deployment.

## Get started

You need [Bun](https://bun.sh), an Anthropic API key, and Prefactor credentials for at least one agent.

### Get Prefactor keys

1. Sign in to the [Prefactor Admin UI](https://app.prefactor.ai) and open your account.
2. On the [Agents page](https://docs.prefactor.ai/admin-ui/agents), select **Register agent**. Create a primary chat agent (and optionally a second support agent). Copy each agent’s ID for `PREFACTOR_AGENT_ID` / `PREFACTOR_AGENT_ID_SUPPORT`.
3. Create an API token. Prefer a [deployment token](https://docs.prefactor.ai/platform/concepts/api-token) from the agent’s **Deployments** tab (**Create deployment token**, pick an environment, copy the value once). Alternatively, create an [account-wide token](https://docs.prefactor.ai/admin-ui/account/api-tokens) under **Account → API tokens** and pass the agent ID separately.
4. Set `PREFACTOR_API_URL` to your Prefactor API base URL (typically `https://api.prefactor.ai`). See [SDK configuration](https://docs.prefactor.ai/sdks/configuration) for the full env var list.

For the optional support deployment, repeat steps 2–3 for a second agent and put its token and ID in the `*_SUPPORT` variables.

```sh
bun install
cp .env.example .env
```

Open `.env` and add your credentials:

```dotenv
ANTHROPIC_API_KEY=your-anthropic-key

PREFACTOR_API_URL=https://api.prefactor.ai
PREFACTOR_API_TOKEN=your-primary-deployment-token
PREFACTOR_AGENT_ID=your-primary-agent-id

PREFACTOR_API_TOKEN_SUPPORT=your-support-deployment-token
PREFACTOR_AGENT_ID_SUPPORT=your-support-agent-id
```

Then start SvelteKit:

```sh
bun run dev
```

Open <http://localhost:5173> and send a message. Try asking about an invoice or account access to trigger a background support investigation.

## What the demo shows

- Streaming Anthropic responses instrumented with Prefactor.
- One Prefactor runtime reused for each active chat session.
- A linked background support agent with primary-agent fallback.
- Sensitive span values marked before they leave application code.
- User feedback recorded as Prefactor quality spans.
- Explicit runtime cleanup when a conversation ends.

After chatting, open Prefactor and inspect the primary deployment. You should see the chat and model spans. A support question also creates a linked investigation on the support deployment when it is configured.

## Configuration

The required values are `ANTHROPIC_API_KEY`, `PREFACTOR_API_URL`, `PREFACTOR_API_TOKEN`, and `PREFACTOR_AGENT_ID`.

To use the support deployment, set `PREFACTOR_API_TOKEN_SUPPORT` and `PREFACTOR_AGENT_ID_SUPPORT` together. The identifier and log-level settings in `.env.example` are optional and have sensible defaults.

Keep `.env` local. It is ignored and is not copied into the Docker image.

## Project structure

- `src/routes` contains the Svelte page and thin API handlers.
- `src/lib/components` contains the chat UI.
- `src/lib/server/agents` defines the primary agent.
- `src/lib/server/support` runs background support investigations.
- `src/lib/server/prefactor.ts` and `prefactor-session-registry.ts` manage Prefactor runtimes.

## Checks

```sh
bun run test
bun run check
bun run lint
bun run build
```

## Docker

The normal Bun workflow is enough for local use. A production Dockerfile is included when you want a container:

```sh
docker build -t prefactor-chatbot-demo .
docker run --rm -p 3000:3000 --env-file .env prefactor-chatbot-demo
```
