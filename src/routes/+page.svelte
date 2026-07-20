<script lang="ts">
	import { Chat, type UIMessage } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import { onMount, tick } from 'svelte';
	import ChatComposer from '$lib/components/ChatComposer.svelte';
	import ChatHeader from '$lib/components/ChatHeader.svelte';
	import ChatTimeline from '$lib/components/ChatTimeline.svelte';
	import EndChatDialog from '$lib/components/EndChatDialog.svelte';
	import FeedbackDialog from '$lib/components/FeedbackDialog.svelte';
	import {
		buildTimeline,
		messageText,
		toStoredMessage,
		toUIMessage
	} from '$lib/client/chat-messages';
	import { uniqueById } from '$lib/messages';
	import { store } from '$lib/stores.svelte';
	import type { Message, SupportActivityEvent } from '$lib/types';

	let chat = $state<Chat>() as Chat;
	let input = $state('');
	let inputEl = $state<HTMLInputElement>();
	let messagesEnd = $state<HTMLDivElement>();
	let stickToBottom = $state(true);
	let supportActivity = $state<SupportActivityEvent[]>([]);
	let eventSource: EventSource | null = null;
	let transientMessageCreatedAt = new Map<string, number>();
	let hydratedSessionId = $state<string | null>(null);
	let queuedSend = $state(false);
	let endingChat = $state(false);
	let showEndConfirmation = $state(false);
	let endChatError = $state('');
	let feedbackDraft = $state<'up' | 'down'>('up');
	let feedbackReasons = $state<string[]>([]);
	let feedbackComment = $state('');
	let feedbackMessage = $state<Message | null>(null);
	let submittingFeedback = $state(false);

	const activeSession = $derived(store.getActiveSession());
	const timeline = $derived.by(() =>
		chat
			? buildTimeline(
					uniqueById(chat.messages),
					activeSession?.messages ?? [],
					supportActivity,
					messageCreatedAt
				)
			: []
	);

	function storedMessage(messageId: string): Message | undefined {
		return activeSession?.messages.find((message) => message.id === messageId);
	}

	function messageCreatedAt(messageId: string, order = 0): number {
		const stored = storedMessage(messageId)?.createdAt;
		if (stored) return stored;
		const transient = transientMessageCreatedAt.get(messageId);
		if (transient) return transient;
		const createdAt = Date.now() + order;
		transientMessageCreatedAt.set(messageId, createdAt);
		return createdAt;
	}

	$effect(() => {
		if (
			!chat ||
			!store.dbReady ||
			!store.activeSessionId ||
			hydratedSessionId === store.activeSessionId
		)
			return;
		const session = store.getActiveSession();
		if (session) chat.messages = session.messages.map(toUIMessage);
		hydratedSessionId = store.activeSessionId;
		queueMicrotask(() => inputEl?.focus());
	});

	$effect(() => {
		if (!chat || !queuedSend || chat.status !== 'ready' || activeSession?.completedAt) return;
		queuedSend = false;
		void chat.sendMessage();
	});

	$effect(() => {
		if (!chat || !stickToBottom) return;
		void chat.messages;
		void supportActivity;
		void chat.status;
		tick().then(() => messagesEnd?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
	});

	$effect(() => {
		void store.activeSessionId;
		feedbackDraft = 'up';
		feedbackReasons = [];
		feedbackComment = '';
		feedbackMessage = null;
		supportActivity = [];
		transientMessageCreatedAt = new Map();
		hydratedSessionId = null;
		queuedSend = false;
		endingChat = false;
		showEndConfirmation = false;
		endChatError = '';
	});

	$effect(() => {
		const sessionId = store.activeSessionId;
		eventSource?.close();
		eventSource = null;
		if (!sessionId || typeof EventSource === 'undefined') return;
		const source = new EventSource(
			`/api/support/events?sessionId=${encodeURIComponent(sessionId)}`
		);
		eventSource = source;
		source.onmessage = (message) => {
			const payload = JSON.parse(message.data) as
				| { type: 'connected' }
				| { type: 'support-activity'; event: SupportActivityEvent & { message?: Message } };
			if (payload.type !== 'support-activity') return;
			supportActivity = [...supportActivity, payload.event];
			if (payload.event.message && store.activeSessionId === sessionId)
				store.appendMessage(sessionId, payload.event.message);
		};
		return () => source.close();
	});

	onMount(async () => {
		await store.init();
		const session = store.getActiveSession();
		chat = new Chat({
			messages: session?.messages.map(toUIMessage) ?? [],
			transport: new DefaultChatTransport({
				prepareSendMessagesRequest: ({ body, messages, id, trigger, messageId }) => ({
					body: { ...body, id, messages, trigger, messageId, sessionId: store.activeSessionId }
				})
			}),
			async onFinish(options) {
				const activeId = store.activeSessionId;
				if (!activeId) return;
				const messages = uniqueById(
					options.messages.map((message, order) =>
						toStoredMessage(message, messageCreatedAt(message.id, order))
					)
				);
				const messageIds = new Set(messages.map((message) => message.id));
				const storedMessages =
					store.getActiveSession()?.messages.filter((message) => !messageIds.has(message.id)) ?? [];
				const mergedMessages = uniqueById(
					[...messages, ...storedMessages].sort((a, b) => a.createdAt - b.createdAt)
				);
				store.syncMessages(activeId, mergedMessages);
				chat.messages = mergedMessages.map(toUIMessage);
			}
		});
	});

	function sendMessage() {
		if (
			!input.trim() ||
			!store.activeSessionId ||
			!chat ||
			activeSession?.completedAt ||
			endingChat
		)
			return;
		const text = input.trim();
		input = '';
		if (chat.status === 'submitted' || chat.status === 'streaming') {
			const message: UIMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				parts: [{ type: 'text', text }]
			};
			const order = chat.messages.length;
			const createdAt = messageCreatedAt(message.id, order);
			chat.messages = [...chat.messages, message];
			store.appendMessage(store.activeSessionId, toStoredMessage(message, createdAt));
			queuedSend = true;
			return;
		}
		void chat.sendMessage({ text });
	}

	async function endChat() {
		const session = store.getActiveSession();
		if (!session || session.completedAt || endingChat || chat.status !== 'ready') return;
		showEndConfirmation = false;
		endChatError = '';
		endingChat = true;
		try {
			const response = await fetch('/api/chat/end', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId: session.id, messages: chat.messages })
			});
			if (!response.ok) throw new Error(await response.text());
			const farewell = (await response.text()).trim();
			if (farewell) {
				const message: Message = {
					id: crypto.randomUUID(),
					role: 'assistant',
					content: farewell,
					createdAt: Date.now()
				};
				store.appendMessage(session.id, message);
				if (store.activeSessionId === session.id)
					chat.messages = [...chat.messages, toUIMessage(message)];
			}
			await store.completeSession(session.id);
			input = '';
			queuedSend = false;
		} catch (error) {
			endChatError = error instanceof Error ? error.message : 'Unable to end chat';
		} finally {
			endingChat = false;
		}
	}

	function openFeedback(message: UIMessage, rating: 'up' | 'down') {
		const stored = storedMessage(message.id);
		feedbackMessage = {
			id: message.id,
			role: 'assistant',
			content: messageText(message),
			createdAt: stored?.createdAt ?? Date.now(),
			feedback: stored?.feedback
		};
		feedbackDraft = rating;
		feedbackReasons = stored?.feedback?.rating === rating ? [...stored.feedback.reasons] : [];
		feedbackComment = stored?.feedback?.rating === rating ? (stored.feedback.comment ?? '') : '';
	}

	async function submitFeedback() {
		const session = store.getActiveSession();
		if (!session || !feedbackMessage || submittingFeedback) return;
		submittingFeedback = true;
		const feedback = {
			rating: feedbackDraft,
			reasons: [...feedbackReasons],
			comment: feedbackComment.trim() || undefined,
			createdAt: Date.now()
		};
		store.setMessageFeedback(session.id, feedbackMessage.id, feedback);
		try {
			const response = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: session.id,
					messageId: feedbackMessage.id,
					messageContent: feedbackMessage.content,
					feedback: feedback.rating,
					reasons: feedback.reasons,
					comment: feedback.comment,
					sessionName: session.name,
					messageCount: session.messages.length
				})
			});
			if (!response.ok) throw new Error(await response.text());
			feedbackMessage = null;
			feedbackReasons = [];
			feedbackComment = '';
		} finally {
			submittingFeedback = false;
		}
	}
</script>

{#if !store.dbReady}
	<div
		class="flex h-dvh items-center justify-center bg-neutral-50 text-sm text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300"
	>
		Loading local data...
	</div>
{:else}
	<div
		class="relative h-dvh overflow-x-hidden bg-neutral-50 text-neutral-900 transition-colors duration-300 dark:bg-neutral-950 dark:text-white"
	>
		<div
			class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(250,250,250,0.96),rgba(245,245,245,0.9)),linear-gradient(90deg,rgba(14,165,233,0.08),rgba(16,185,129,0.08))] dark:bg-[linear-gradient(180deg,rgba(10,10,10,0.96),rgba(23,23,23,0.98)),linear-gradient(90deg,rgba(14,165,233,0.12),rgba(16,185,129,0.08))]"
		></div>
		<div class="relative z-10 flex h-dvh min-h-0 flex-col">
			<ChatHeader onSessionChange={() => (stickToBottom = true)} />
			<ChatTimeline
				{timeline}
				status={chat?.status ?? 'ready'}
				{storedMessage}
				onFeedback={openFeedback}
				onScroll={(element) => {
					const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
					stickToBottom = distance < 96;
				}}
				bind:messagesEnd
			/>
			<ChatComposer
				bind:input
				bind:inputElement={inputEl}
				completed={Boolean(activeSession?.completedAt)}
				ending={endingChat}
				status={chat?.status ?? 'ready'}
				error={endChatError || store.persistenceError || ''}
				onSend={sendMessage}
				onRequestEnd={() => (showEndConfirmation = true)}
			/>
		</div>
	</div>
	{#if feedbackMessage}<FeedbackDialog
			message={feedbackMessage}
			bind:rating={feedbackDraft}
			bind:selectedReasons={feedbackReasons}
			bind:comment={feedbackComment}
			submitting={submittingFeedback}
			onClose={() => (feedbackMessage = null)}
			onSubmit={submitFeedback}
		/>{/if}
	{#if showEndConfirmation}<EndChatDialog
			onCancel={() => (showEndConfirmation = false)}
			onConfirm={() => void endChat()}
		/>{/if}
{/if}
