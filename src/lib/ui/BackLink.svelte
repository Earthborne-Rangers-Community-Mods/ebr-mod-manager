<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<a href="/" class="back-link">&larr; {m.back_to_browse()}</a>

<style>
	.back-link {
		display: inline-block;
		font-size: var(--font-size-sm);
		color: var(--color-primary);
		margin-bottom: var(--spacing-lg);
		transition: color var(--transition-fast);
	}

	.back-link:hover {
		text-decoration: underline;
	}
</style>
