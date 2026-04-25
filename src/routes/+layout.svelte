<script lang="ts">
	import '../app.css';
	import * as m from '$lib/paraglide/messages.js';

	let { children } = $props();
</script>

<header class="app-header">
	<div class="container header-inner">
		<a href="/" class="logo">{m.app_title()}</a>
	</div>
</header>

<main class="container">
	{@render children()}
</main>

<style>
	.app-header {
		border-bottom: 1px solid var(--color-border);
		padding: 0.75rem 0;
		margin-bottom: 1.5rem;
	}

	.header-inner {
		display: flex;
		align-items: center;
	}

	.logo {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.logo:hover {
		text-decoration: none;
	}

	main {
		padding-bottom: 2rem;
	}
</style>
