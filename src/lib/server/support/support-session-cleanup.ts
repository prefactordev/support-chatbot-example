import { supportJobRegistry } from './support-jobs';
import { createSupportSessionCleanup } from './support-session-lifecycle';

export const cleanupSupportSession = createSupportSessionCleanup({
	cleanupJobs: (sessionId) => supportJobRegistry.cleanupSession(sessionId)
});
