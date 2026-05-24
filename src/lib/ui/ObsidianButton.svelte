<script lang="ts">
	import { Capacitor } from '@capacitor/core';
	import { asset } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';

	// Android doesn't support obsidian://choose-vault; use bare obsidian:// to just open the app
	const href = Capacitor.isNativePlatform() ? 'obsidian://' : 'obsidian://choose-vault';
</script>

<a class="obsidian-button" {href} aria-label={m.open_obsidian()} title={m.open_obsidian()}>
	<img src={asset('/obsidian-logo.svg')} alt="" class="obsidian-logo" aria-hidden="true" />
</a>

<style>
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
</style>
