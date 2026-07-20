<script lang="ts">
	import { ThumbsDown, ThumbsUp, X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import type { Message } from '$lib/types';

	const reasons = {
		up: [
			{ id: 'helpful', label: 'Helpful and accurate' },
			{ id: 'clear', label: 'Clear and easy to understand' },
			{ id: 'fast', label: 'Fast and responsive' }
		],
		down: [
			{ id: 'inaccurate', label: 'Inaccurate or wrong' },
			{ id: 'unclear', label: 'Hard to understand' },
			{ id: 'incomplete', label: 'Incomplete or unhelpful' }
		]
	} as const;
	let {
		message,
		rating = $bindable(),
		selectedReasons = $bindable(),
		comment = $bindable(),
		submitting,
		onClose,
		onSubmit
	}: {
		message: Message;
		rating: 'up' | 'down';
		selectedReasons: string[];
		comment: string;
		submitting: boolean;
		onClose: () => void;
		onSubmit: () => void;
	} = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/35 px-4 py-4 backdrop-blur-sm sm:items-center"
	role="presentation"
	transition:fly={{ y: 10, duration: 160, opacity: 0 }}
>
	<div
		class="w-full max-w-lg rounded-2xl border border-white/70 bg-white p-4 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-neutral-950"
		role="dialog"
		aria-modal="true"
		aria-label="Submit feedback for this response"
	>
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-sm font-semibold text-neutral-950 dark:text-white">Rate this response</p>
				<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
					{message.content}
				</p>
			</div>
			<button
				type="button"
				aria-label="Close feedback"
				onclick={onClose}
				class="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
				><X class="size-4 shrink-0" aria-hidden="true" /></button
			>
		</div>
		<div class="mt-4 grid grid-cols-2 gap-2">
			<button
				type="button"
				aria-pressed={rating === 'up'}
				onclick={() => {
					rating = 'up';
					selectedReasons = [];
				}}
				class={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${rating === 'up' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10'}`}
				><ThumbsUp class="size-4 shrink-0" aria-hidden="true" />Helpful</button
			>
			<button
				type="button"
				aria-pressed={rating === 'down'}
				onclick={() => {
					rating = 'down';
					selectedReasons = [];
				}}
				class={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${rating === 'down' ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-100' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10'}`}
				><ThumbsDown class="size-4 shrink-0" aria-hidden="true" />Needs work</button
			>
		</div>
		<div class="mt-4 space-y-3">
			<p class="text-xs font-medium text-neutral-600 dark:text-neutral-300">
				{rating === 'up' ? 'What went well?' : 'What could be better?'}
			</p>
			<div class="space-y-2">
				{#each reasons[rating] as reason (reason.id)}<label
						class="flex cursor-pointer items-start gap-2.5 rounded-lg text-sm text-neutral-700 transition-colors hover:text-neutral-950 dark:text-neutral-200 dark:hover:text-white"
						><input
							type="checkbox"
							checked={selectedReasons.includes(reason.id)}
							onchange={() => {
								selectedReasons = selectedReasons.includes(reason.id)
									? selectedReasons.filter((item) => item !== reason.id)
									: [...selectedReasons, reason.id];
							}}
							class="mt-0.5 size-4 shrink-0 rounded border-neutral-300 text-sky-700 focus:ring-sky-500/30 dark:border-white/20 dark:bg-white/5 dark:text-sky-300"
						/><span>{reason.label}</span></label
					>{/each}
			</div>
			<textarea
				bind:value={comment}
				placeholder="Anything else? (optional)"
				rows="3"
				class="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-neutral-400 dark:focus:border-sky-400"
			></textarea>
		</div>
		<div class="mt-4 flex justify-end gap-2">
			<button
				type="button"
				onclick={onClose}
				class="rounded-xl px-3 py-2 text-sm text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
				>Cancel</button
			><button
				type="button"
				onclick={onSubmit}
				disabled={submitting}
				class="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(2,132,199,0.65)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
				>{submitting ? 'Submitting...' : 'Submit feedback'}</button
			>
		</div>
	</div>
</div>
