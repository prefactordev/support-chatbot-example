import { parseServerConfig, type ServerConfig } from './config.ts';

export type ServerConfigProvider = () => ServerConfig;

export function createServerConfigProvider(
	readEnvironment: () => Record<string, string | undefined>
): ServerConfigProvider {
	let config: ServerConfig | undefined;
	return () => (config ??= parseServerConfig(readEnvironment()));
}
