<script lang="ts">
	import { browser } from '$app/environment';
	import { marked } from 'marked';

	let { content }: { content: string } = $props();

	let html = $state('');

	marked.setOptions({ gfm: true, breaks: true });

	$effect(() => {
		if (!browser || !content) {
			html = '';
			return;
		}

		void import('dompurify').then(({ default: DOMPurify }) => {
			const raw = marked.parse(content, { async: false }) as string;
			html = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
		});
	});
</script>

<div
	class="prose prose-sm max-w-none text-sm leading-relaxed prose-neutral dark:prose-invert [&_a]:text-neutral-700 [&_a]:underline dark:[&_a]:text-neutral-200 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:bg-neutral-200/80 [&_code:not(pre_code)]:px-1 [&_code:not(pre_code)]:py-0.5 dark:[&_code:not(pre_code)]:bg-neutral-800/80 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-neutral-200/60 [&_pre]:bg-neutral-900/95 [&_pre]:text-neutral-100 dark:[&_pre]:border-white/10 [&_pre_code]:bg-transparent [&_pre_code]:p-0"
>
	{@html html}
</div>
