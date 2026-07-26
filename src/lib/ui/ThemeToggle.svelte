<script lang="ts">
	import { asset } from '$app/paths';
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
	<span
		class="theme-icon"
		style={`--icon: url("${asset(theme === 'light' ? '/moon.svg' : '/sun.svg')}")`}
		aria-hidden="true"
	></span>
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
		display: block;
		width: 1.25rem;
		height: 1.25rem;
		background-color: currentColor;
		mask: var(--icon) no-repeat center / contain;
		-webkit-mask: var(--icon) no-repeat center / contain;
	}
</style>
