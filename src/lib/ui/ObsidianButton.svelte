<script lang="ts">
	import { Capacitor } from '@capacitor/core';
	import { asset } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { OBSIDIAN_DOWNLOAD_URL, hasSeenObsidianIntro } from '$lib/obsidian-intro.js';

	// Desktop opens the vault picker; native (Android) opens the app, since
	// Android does not support obsidian://choose-vault
	const href = Capacitor.isNativePlatform() ? 'obsidian://' : 'obsidian://choose-vault';

	// We cannot detect whether Obsidian is installed. Tapping the
	// button either launches Obsidian or does nothing; revealing the fallback
	// after a tap covers the "nothing happened" case without any detection.
	let showFallback = $state(false);

	function handleObsidianClick() {
		if (!hasSeenObsidianIntro()) {
			showFallback = true;
		}
	}
</script>

<div class="obsidian-control">
	<a
		class="obsidian-button"
		{href}
		aria-label={m.open_obsidian()}
		title={m.open_obsidian()}
		onclick={handleObsidianClick}
	>
		<img src={asset('/obsidian-logo.svg')} alt="" class="obsidian-logo" aria-hidden="true" />
	</a>
	{#if showFallback}
		<div class="fallback" role="status">
			<button
				class="fallback-close"
				type="button"
				aria-label={m.dismiss()}
				onclick={() => (showFallback = false)}>X</button
			>
			<span>{m.obsidian_fallback_prefix()}</span>
			<a href={OBSIDIAN_DOWNLOAD_URL} target="_blank" rel="noopener">{m.obsidian_fallback_link()}</a>
		</div>
	{/if}
</div>

<style>
	.obsidian-control {
		position: relative;
		display: inline-flex;
	}

	.obsidian-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		text-decoration: none;
		cursor: pointer;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}

	.obsidian-button:hover {
		background: var(--color-surface-hover);
		border-color: var(--color-primary);
		text-decoration: none;
	}

	.obsidian-logo {
		width: 1.5rem;
		height: 1.5rem;
	}

	.fallback {
		position: absolute;
		top: calc(100% + var(--spacing-xs));
		right: 0;
		z-index: 1050;
		width: max-content;
		max-width: min(20rem, calc(100vw - 2 * var(--spacing-md)));
		padding: var(--spacing-sm) var(--spacing-xl) var(--spacing-sm) var(--spacing-sm);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-sm);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	.fallback-close {
		position: absolute;
		top: var(--spacing-xs);
		right: var(--spacing-xs);
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--font-size-xs);
		padding: 0 var(--spacing-xs);
		line-height: 1.4;
	}

	.fallback-close:hover {
		color: var(--color-text);
	}
</style>
