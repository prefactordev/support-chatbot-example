<script lang="ts">
	import { fly } from 'svelte/transition';
	let { onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void } = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/35 px-4 py-4 backdrop-blur-sm sm:items-center"
	role="presentation"
	transition:fly={{ y: 10, duration: 160, opacity: 0 }}
>
	<div
		class="w-full max-w-md rounded-2xl border border-white/70 bg-white p-5 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-neutral-950"
		role="dialog"
		aria-modal="true"
		aria-label="End this chat"
	>
		<p class="text-sm font-semibold text-neutral-950 dark:text-white">End this chat?</p>
		<p class="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
			The assistant will send a final thank-you. You won't be able to send more messages in this
			chat.
		</p>
		<div class="mt-5 flex justify-end gap-2">
			<button
				type="button"
				onclick={onCancel}
				class="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10"
				>Cancel</button
			><button
				type="button"
				onclick={onConfirm}
				class="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
				>End chat</button
			>
		</div>
	</div>
</div>
