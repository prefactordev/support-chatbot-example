<script lang="ts">
	import { CircleStop, Send } from '@lucide/svelte';

	let {
		input = $bindable(),
		inputElement = $bindable(),
		completed,
		ending,
		status,
		error,
		onSend,
		onRequestEnd
	}: {
		input: string;
		inputElement?: HTMLInputElement;
		completed: boolean;
		ending: boolean;
		status: string;
		error: string;
		onSend: () => void;
		onRequestEnd: () => void;
	} = $props();
</script>

<footer class="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
	<div
		class="mx-auto max-w-3xl space-y-3 rounded-[1.35rem] shadow-[0_8px_32px_-8px_rgba(23,23,23,0.12),0_24px_64px_-24px_rgba(23,23,23,0.35)] backdrop-blur-2xl"
	>
		{#if completed}
			<div
				class="flex min-h-15 items-center justify-center gap-2 rounded-[1.25rem] border border-white/60 bg-white/70 px-4 text-sm font-medium text-neutral-500 dark:border-white/10 dark:bg-neutral-950/75 dark:text-neutral-400"
			>
				<CircleStop class="size-4 shrink-0" aria-hidden="true" />Chat ended
			</div>
		{:else}
			<div
				class="flex items-center gap-2 rounded-[1.25rem] border border-white/60 bg-white/70 p-2 dark:border-white/10 dark:bg-neutral-950/75"
			>
				<button
					type="button"
					onclick={onRequestEnd}
					disabled={ending || status !== 'ready'}
					class="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[1.05rem] border border-neutral-200 bg-white/70 px-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-white hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
					><CircleStop class="size-4 shrink-0" aria-hidden="true" /><span class="hidden sm:inline"
						>End chat</span
					></button
				>
				<input
					bind:value={input}
					bind:this={inputElement}
					disabled={ending}
					onkeydown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							onSend();
						}
					}}
					placeholder={ending ? 'Ending chat...' : 'Ask about your account...'}
					class="min-h-11 min-w-0 flex-1 rounded-[1.05rem] border border-white/60 bg-white/85 px-4 py-2.5 text-sm leading-normal text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-neutral-400 dark:focus:border-sky-400 dark:focus:bg-white/10"
				/>
				<button
					type="button"
					onclick={onSend}
					disabled={!input.trim() || ending}
					class="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[1.05rem] bg-sky-700 px-4 text-sm font-medium text-white shadow-[0_18px_40px_-18px_rgba(2,132,199,0.65)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
					>{#if ending || status === 'streaming'}<span
							class="h-2 w-2 animate-pulse rounded-full bg-white/80"
						></span>{:else}<Send class="size-4 shrink-0" aria-hidden="true" />{/if}Send</button
				>
			</div>
		{/if}
		{#if error}<p class="px-3 pb-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>{/if}
	</div>
</footer>
