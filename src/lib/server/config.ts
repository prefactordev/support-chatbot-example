import { z } from 'zod';

const requiredEnvironmentSchema = z.object({
	ANTHROPIC_API_KEY: z.string().trim().min(1),
	PREFACTOR_API_URL: z.string().trim().url(),
	PREFACTOR_API_TOKEN: z.string().trim().min(1),
	PREFACTOR_AGENT_ID: z.string().trim().min(1)
});

type SupportAgentConfig = {
	agentId: string;
	apiToken: string;
	agentIdentifier: string;
};

export type ServerConfig = {
	anthropic: { apiKey: string; model: string };
	prefactor: {
		apiUrl: string;
		apiToken: string;
		agentId: string;
		agentIdentifier: string;
		logLevel: string;
	};
	supportAgent?: SupportAgentConfig;
	evalEnabled: boolean;
};

export function parseServerConfig(environment: Record<string, string | undefined>): ServerConfig {
	const parsed = requiredEnvironmentSchema.safeParse(environment);
	if (!parsed.success) {
		const keys = parsed.error.issues.map((issue) => String(issue.path[0])).join(', ');
		throw new Error(`Missing or invalid required environment variables: ${keys}`);
	}

	return {
		anthropic: {
			apiKey: parsed.data.ANTHROPIC_API_KEY,
			model: clean(environment.ANTHROPIC_MODEL) ?? 'claude-haiku-4-5'
		},
		prefactor: {
			apiUrl: parsed.data.PREFACTOR_API_URL,
			apiToken: parsed.data.PREFACTOR_API_TOKEN,
			agentId: parsed.data.PREFACTOR_AGENT_ID,
			agentIdentifier: clean(environment.PREFACTOR_AGENT_IDENTIFIER) ?? '1.0.0',
			logLevel: clean(environment.PREFACTOR_LOG_LEVEL) ?? 'info'
		},
		supportAgent: readSupportAgent(environment),
		evalEnabled: readBoolean(environment.EVAL_ENABLED) ?? true
	};
}

function readSupportAgent(
	environment: Record<string, string | undefined>
): SupportAgentConfig | undefined {
	const agentId = clean(environment.PREFACTOR_AGENT_ID_SUPPORT);
	const apiToken = clean(environment.PREFACTOR_API_TOKEN_SUPPORT);
	if (!agentId || !apiToken) return undefined;

	return {
		agentId,
		apiToken,
		agentIdentifier: clean(environment.PREFACTOR_AGENT_IDENTIFIER_SUPPORT) ?? '1.0.0'
	};
}

function clean(value: string | undefined): string | undefined {
	const cleaned = value?.trim();
	return cleaned || undefined;
}

function readBoolean(value: string | undefined): boolean | undefined {
	const cleaned = value?.trim().toLowerCase();
	if (cleaned === 'true' || cleaned === '1') return true;
	if (cleaned === 'false' || cleaned === '0') return false;
	return undefined;
}
