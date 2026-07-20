type LifecycleAwareProvider = {
	agentLifecycle?: { started: boolean };
};

/**
 * Keeps the Prefactor AI middleware's private registration flag aligned with
 * manual sensitive-span registration. This adapter contains the SDK v0.3.x
 * compatibility workaround so the rest of the runtime stays on public APIs.
 */
export function createRegistrationGuard(provider: unknown, startInstance: () => void) {
	const lifecycleProvider = provider as LifecycleAwareProvider;
	return () => {
		if (lifecycleProvider.agentLifecycle?.started) return;
		startInstance();
		if (lifecycleProvider.agentLifecycle) lifecycleProvider.agentLifecycle.started = true;
	};
}
