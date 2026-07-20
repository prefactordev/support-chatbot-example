import { createAnthropic } from '@ai-sdk/anthropic';
import { getServerConfig } from './application-config';
import type { ServerConfig } from './config';

type AnthropicConfig = ServerConfig['anthropic'];

let defaultModelFactory: ReturnType<typeof createAnthropic> | undefined;

export function createChatModel(config?: AnthropicConfig) {
	if (config) {
		return createAnthropic({ apiKey: config.apiKey })(config.model);
	}
	const defaultConfig = getServerConfig().anthropic;
	defaultModelFactory ??= createAnthropic({ apiKey: defaultConfig.apiKey });
	return defaultModelFactory(defaultConfig.model);
}
