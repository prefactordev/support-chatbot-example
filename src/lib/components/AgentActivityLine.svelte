<script lang="ts">
	import type { SupportActivityEvent } from '$lib/types';

	let { event }: { event: SupportActivityEvent } = $props();

	const tone = $derived(
		event.status === 'started'
			? 'border-amber-200/70 bg-amber-50/90 text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-100'
			: event.status === 'failed'
				? 'border-rose-200/70 bg-rose-50/90 text-rose-950 dark:border-rose-500/25 dark:bg-rose-950/40 dark:text-rose-100'
				: 'border-emerald-200/70 bg-emerald-50/90 text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-100'
	);
</script>

<div class="flex justify-start overflow-visible py-0.5" aria-live="polite">
	<div
		class="max-w-[88%] rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur-xl sm:max-w-[80%] {tone}"
	>
		<span class="font-semibold">Support check</span>
		<span class="opacity-85">
			{event.status === 'started'
				? ' started: '
				: event.status === 'failed'
					? ' failed: '
					: ' completed: '}
		</span>
		<span>{event.label}</span>
		{#if event.status === 'failed' && event.excerpt}
			<p class="mt-1 line-clamp-2 leading-relaxed opacity-90">{event.excerpt}</p>
		{/if}
	</div>
</div>
