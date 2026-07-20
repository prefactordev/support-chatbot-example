type SupportSessionCleanupDependencies = {
	cleanupJobs: (sessionId: string) => Promise<void>;
};

export function createSupportSessionCleanup(dependencies: SupportSessionCleanupDependencies) {
	return async (sessionId: string): Promise<void> => {
		await dependencies.cleanupJobs(sessionId);
	};
}
