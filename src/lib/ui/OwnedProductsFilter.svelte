<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { KNOWN_PRODUCT_IDS, resolveProductDisplayName } from '$lib/catalogs.js';

	interface Props {
		/** Id for the rendered fieldset, wired to the controlling toggle's aria-controls. */
		id: string;
		/** The set of product ids the user owns, or null before it has loaded. */
		ownedProducts: Set<string> | null;
		/** Called when a product checkbox is toggled. The page owns persistence. */
		onToggle: (productId: string, owned: boolean) => void;
	}

	let { id, ownedProducts, onToggle }: Props = $props();
</script>

<fieldset class="filter-group" {id}>
	<legend>{m.owned_products_heading()}</legend>
	<div class="owned-products-list">
		{#each KNOWN_PRODUCT_IDS as productId}
			<label class="product-option">
				<input
					type="checkbox"
					checked={ownedProducts?.has(productId) ?? false}
					onchange={(e) => onToggle(productId, e.currentTarget.checked)}
				/>
				{resolveProductDisplayName(productId)}
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.filter-group {
		border: none;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	.filter-group legend {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		padding: 0;
		margin-bottom: var(--spacing-xs);
	}

	.owned-products-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--spacing-xs) var(--spacing-md);
	}

	.product-option {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.product-option input {
		width: 1.1rem;
		height: 1.1rem;
		flex-shrink: 0;
		accent-color: var(--color-primary);
	}
</style>
