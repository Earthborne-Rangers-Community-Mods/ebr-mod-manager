<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolveModTypeName, resolveModTypeDescription } from '$lib/catalogs.js';
	import type { ModType } from '$lib/registry.js';

	interface Props {
		/** Id for the rendered fieldset, wired to the controlling toggle's aria-controls. */
		id: string;
		/** Currently-selected mod types. Toggling a checkbox reassigns this set. */
		selectedTypes: Set<ModType>;
	}

	let { id, selectedTypes = $bindable() }: Props = $props();

	// Record<ModType, ...> forces exhaustiveness: a newly-added mod type fails to
	// compile here until it is listed, so it cannot silently vanish from the
	// filter. Object.keys preserves this declaration order as the display order.
	const MOD_TYPE_PRESENCE: Record<ModType, true> = {
		enhancement: true,
		expansion: true,
		'one-day-mission': true,
		campaign: true,
		collection: true,
		theme: true,
	};
	const MOD_TYPES = Object.keys(MOD_TYPE_PRESENCE) as ModType[];

	function toggle(type: ModType, selected: boolean) {
		const next = new Set(selectedTypes);
		if (selected) {
			next.add(type);
		} else {
			next.delete(type);
		}
		selectedTypes = next;
	}
</script>

<fieldset class="filter-group" {id}>
	<legend>{m.mod_types_heading()}</legend>
	<div class="mod-types-list">
		{#each MOD_TYPES as type}
			<label class="type-option">
				<input
					type="checkbox"
					checked={selectedTypes.has(type)}
					onchange={(e) => toggle(type, e.currentTarget.checked)}
				/>
				<span class="type-option-text">
					<span class="type-option-name">{resolveModTypeName(type)}</span>
					<span class="type-option-desc">{resolveModTypeDescription(type)}</span>
				</span>
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

	.mod-types-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--spacing-sm) var(--spacing-md);
	}

	.type-option {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.type-option input {
		width: 1.1rem;
		height: 1.1rem;
		flex-shrink: 0;
		margin-top: 0.15rem;
		accent-color: var(--color-primary);
	}

	.type-option-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.type-option-name {
		font-weight: 600;
	}

	.type-option-desc {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		line-height: var(--line-height-normal);
	}
</style>
