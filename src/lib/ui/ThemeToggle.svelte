<script lang="ts">
	import { getTheme, toggleTheme, type Theme } from '$lib/theme.js';

	let theme = $state<Theme>(getTheme());

	function handleToggle() {
		toggleTheme();
		theme = getTheme();
	}
</script>

<button
	class="theme-toggle"
	onclick={handleToggle}
	aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
	title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
>
	{#if theme === 'light'}
		<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
		</svg>
	{:else}
		<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="5"/>
			<line x1="12" y1="1" x2="12" y2="3"/>
			<line x1="12" y1="21" x2="12" y2="23"/>
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
			<line x1="1" y1="12" x2="3" y2="12"/>
			<line x1="21" y1="12" x2="23" y2="12"/>
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		min-height: 2.5rem;
		padding: 0;
		background: transparent;
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}

	.theme-toggle:hover {
		background: var(--color-surface-hover);
		border-color: var(--color-primary);
	}

	.theme-icon {
		width: 1.25rem;
		height: 1.25rem;
	}
</style>
