<script lang="ts">
	import { Moon, Plus, Sun, X } from '@lucide/svelte';
	import { store } from '$lib/stores.svelte';

	let { onSessionChange }: { onSessionChange: () => void } = $props();
</script>

<header
	class="shrink-0 border-b border-white/60 bg-white/70 backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/55"
>
	<div class="mx-auto flex max-w-6xl min-w-0 items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
		<div class="shrink-0">
			<p class="text-sm font-semibold tracking-normal whitespace-nowrap">Northstar Cloud</p>
			<p class="text-xs whitespace-nowrap text-neutral-500 dark:text-neutral-400">
				Support assistant demo
			</p>
		</div>
		<div
			class="flex min-w-0 flex-1 scrollbar-none items-center gap-2 overflow-x-auto overscroll-x-contain py-0.5"
		>
			{#each store.sessions as session}
				<div
					class={`group flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm shadow-sm backdrop-blur-xl transition-colors ${store.activeSessionId === session.id ? 'border-sky-200 bg-white text-neutral-900 dark:border-sky-400/20 dark:bg-white/10 dark:text-white' : 'border-white/60 bg-white/50 text-neutral-600 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10'}`}
				>
					<button
						type="button"
						onclick={() => {
							store.setActiveSession(session.id);
							onSessionChange();
						}}
						class="max-w-30 truncate text-left sm:max-w-40"
						title={session.name}>{session.name}</button
					>
					{#if store.sessions.length > 1}
						<button
							type="button"
							aria-label="Delete session"
							onclick={(event) => {
								event.stopPropagation();
								void store.deleteSession(session.id);
							}}
							class="shrink-0 rounded-full p-0.5 text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-white/90"
						>
							<X class="size-3.5 shrink-0" aria-hidden="true" />
						</button>
					{/if}
				</div>
			{/each}
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<button
				type="button"
				onclick={() => {
					void store.newSession();
					onSessionChange();
				}}
				class="flex shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-neutral-400/50 bg-white/45 px-3 py-2 text-sm text-neutral-600 shadow-sm transition-colors hover:border-neutral-400/80 hover:bg-white hover:text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
			>
				<Plus class="size-4 shrink-0" aria-hidden="true" /> New
			</button>
			<button
				type="button"
				onclick={() => store.toggleDarkMode()}
				class="shrink-0 rounded-2xl border border-white/60 bg-white/60 p-2.5 text-neutral-600 shadow-sm backdrop-blur-xl transition-colors hover:bg-white hover:text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
				aria-label="Toggle dark mode"
			>
				{#if store.darkMode}<Sun class="size-5 shrink-0" aria-hidden="true" />{:else}<Moon
						class="size-5 shrink-0"
						aria-hidden="true"
					/>{/if}
			</button>
		</div>
	</div>
</header>
