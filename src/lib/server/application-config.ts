import { env } from '$env/dynamic/private';
import { createServerConfigProvider } from './server-config-provider';

export const getServerConfig = createServerConfigProvider(() => env);
