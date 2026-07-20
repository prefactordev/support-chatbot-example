<script lang="ts">
	import type { UIMessage } from 'ai';
	import { ThumbsDown, ThumbsUp } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import AgentActivityLine from './AgentActivityLine.svelte';
	import MarkdownContent from './MarkdownContent.svelte';
	import { messageText, type TimelineItem } from '$lib/client/chat-messages';
	import type { Message } from '$lib/types';

	let {
		timeline,
		status,
		storedMessage,
		onFeedback,
		onScroll,
		messagesEnd = $bindable()
	}: {
		timeline: TimelineItem[];
		status: string;
		storedMessage: (id: string) => Message | undefined;
		onFeedback: (message: UIMessage, rating: 'up' | 'down') => void;
		onScroll: (element: HTMLElement) => void;
		messagesEnd?: HTMLDivElement;
	} = $props();
</script>

<main
	onscroll={(event) => onScroll(event.currentTarget)}
	class="chat-scroll min-h-0 flex-1 scroll-pt-6 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-8"
>
	<div class="mx-auto max-w-3xl space-y-5 pt-4 pb-8">
		{#each timeline as item (item.id)}
			{#if item.kind === 'message'}
				{@const message = item.message}
				{@const text = messageText(message)}
				{@const savedMessage = storedMessage(message.id)}
				{#if text.trim()}
					<div
						class={`flex overflow-visible py-0.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
						transition:fly={{ y: 14, duration: 220, opacity: 0 }}
					>
						<div
							class={`max-w-[88%] sm:max-w-[80%] ${message.role === 'user' ? '' : 'space-y-1.5'}`}
						>
							<div
								class={`rounded-[1.35rem] border px-4 py-3.5 shadow-[0_24px_60px_-34px_rgba(23,23,23,0.55)] backdrop-blur-xl ${message.role === 'user' ? 'border-sky-500/20 bg-sky-700 text-white' : 'border-white/60 bg-white/80 text-neutral-800 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100'}`}
							>
								{#if message.role === 'assistant'}<MarkdownContent content={text} />{:else}<p
										class="text-sm leading-relaxed whitespace-pre-wrap"
									>
										{text}
									</p>{/if}
							</div>
							{#if message.role === 'assistant'}
								<div class="flex items-center gap-1 pl-2">
									<button
										type="button"
										aria-label="Thumbs up for this response"
										aria-pressed={savedMessage?.feedback?.rating === 'up'}
										onclick={() => onFeedback(message, 'up')}
										class={`rounded-full p-1.5 transition-colors ${savedMessage?.feedback?.rating === 'up' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'text-neutral-400 hover:bg-white/70 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-neutral-200'}`}
										><ThumbsUp class="size-3.5 shrink-0" aria-hidden="true" /></button
									>
									<button
										type="button"
										aria-label="Thumbs down for this response"
										aria-pressed={savedMessage?.feedback?.rating === 'down'}
										onclick={() => onFeedback(message, 'down')}
										class={`rounded-full p-1.5 transition-colors ${savedMessage?.feedback?.rating === 'down' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200' : 'text-neutral-400 hover:bg-white/70 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-neutral-200'}`}
										><ThumbsDown class="size-3.5 shrink-0" aria-hidden="true" /></button
									>
									{#if savedMessage?.feedback}<span
											class="text-xs text-neutral-400 dark:text-neutral-500">Feedback sent</span
										>{/if}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{:else}<AgentActivityLine event={item.event} />{/if}
		{/each}
		{#if status === 'streaming'}
			<div
				class="flex justify-start overflow-visible py-0.5"
				transition:fly={{ y: 10, duration: 180, opacity: 0 }}
			>
				<div
					class="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/75 px-4 py-2 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
				>
					<span class="h-2 w-2 animate-pulse rounded-full bg-sky-500"></span>Responding
				</div>
			</div>
		{/if}
		<div bind:this={messagesEnd} class="h-px shrink-0 scroll-mb-6" aria-hidden="true"></div>
	</div>
</main>

<style>
	.chat-scroll {
		scrollbar-gutter: stable;
	}
</style>
