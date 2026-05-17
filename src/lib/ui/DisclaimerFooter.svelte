<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<footer class="app-footer">
	<div class="container footer-inner">
		<p class="disclaimer">{m.disclaimer()}</p>
	</div>
</footer>

<style>
	.app-footer {
		border-top: 1px solid var(--color-border);
		padding: var(--spacing-sm) 0;
		margin-top: var(--spacing-lg);
	}

	.footer-inner {
		text-align: center;
	}

	.disclaimer {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		line-height: 1.35;
		max-width: 48rem;
		margin: 0 auto;
	}
</style>
