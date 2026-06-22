<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { asset } from '$app/paths';
	import {
		OBSIDIAN_DOWNLOAD_URL,
		confirmObsidianIntro,
		dismissObsidianIntro,
	} from '$lib/obsidian-intro.js';

	// A single screenshot of a mod open in Obsidian, served from
	// static/screenshots/.
	const SCREENSHOT = { src: '/screenshots/mod-in-obsidian.png', alt: '' };

	let dialogEl = $state<HTMLDivElement | null>(null);

	// Move focus into the dialog when it mounts so keyboard and screen-reader
	// users land on the explainer rather than the page behind it.
	$effect(() => {
		dialogEl?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			dismissObsidianIntro();
		}
	}

	// Dismiss only when the backdrop itself is clicked, not when the click
	// originates inside the dialog.
	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) dismissObsidianIntro();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="overlay" onclick={handleOverlayClick}>
	<div
		class="dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby="obsidian-intro-title"
		bind:this={dialogEl}
	>
		<h2 id="obsidian-intro-title" class="title">{m.obsidian_intro_title()}</h2>
		<p class="body">{m.obsidian_intro_body()}</p>

		<div class="screenshots" aria-hidden="true">
			<img class="screenshot" src={asset(SCREENSHOT.src)} alt={SCREENSHOT.alt} />
		</div>

		<div class="actions">
			<a class="btn-get" href={OBSIDIAN_DOWNLOAD_URL} target="_blank" rel="noopener">
				{m.obsidian_intro_get_obsidian()}
			</a>
			<button class="btn-have-it" data-autofocus onclick={confirmObsidianIntro}>
				{m.obsidian_intro_have_it()}
			</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-md);
		background: rgba(0, 0, 0, 0.5);
	}

	.dialog {
		width: 100%;
		max-width: 30rem;
		max-height: calc(100dvh - 2 * var(--spacing-md));
		overflow-y: auto;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-sm);
		padding: var(--spacing-lg);
	}

	.title {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-accent);
		margin-bottom: var(--spacing-sm);
	}

	.body {
		font-size: var(--font-size-base);
		line-height: 1.6;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	.screenshots {
		display: flex;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-lg);
	}

	.screenshot {
		width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		justify-content: flex-end;
		align-items: center;
	}

	.btn-get {
		font-size: var(--font-size-base);
		padding: var(--spacing-sm) var(--spacing-xl);
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--color-primary);
		color: var(--color-primary-text);
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 600;
		text-decoration: none;
		transition: background var(--transition-fast);
		touch-action: manipulation;
	}

	.btn-get:hover {
		background: var(--color-primary-hover);
		text-decoration: none;
	}

	.btn-have-it {
		font-size: var(--font-size-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		min-height: 2.75rem;
		background: transparent;
		color: var(--color-primary);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 500;
		transition: background var(--transition-fast), color var(--transition-fast);
		touch-action: manipulation;
	}

	.btn-have-it:hover {
		background: var(--color-primary);
		color: var(--color-primary-text);
	}
</style>
