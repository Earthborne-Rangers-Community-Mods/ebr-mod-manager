<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		resolveCampaignDisplayName,
		resolveProductDisplayName,
		resolveModTypeName,
		resolveModTypeDescription,
	} from '$lib/catalogs.js';
	import type { ModDetail } from '$lib/registry.js';

	interface Props {
		mod: ModDetail;
	}

	let { mod }: Props = $props();

	const typeName = $derived(resolveModTypeName(mod.type));
	const typeDescription = $derived(resolveModTypeDescription(mod.type));
</script>

<div class="metadata">
	<div class="meta-section at-a-glance">
		<h3>{m.mod_detail_at_a_glance()}</h3>
		<dl class="facts">
			<dt>{m.mod_detail_type()}</dt>
			<dd class="type-fact">
				<span>{typeName}</span>
				{#if typeDescription}
					<span class="type-desc">{typeDescription}</span>
				{/if}
			</dd>
			<dt>{m.mod_detail_version_label()}</dt>
			<dd>{mod.latestVersion}</dd>
			{#if mod.updatedAt}
				<dt>{m.mod_detail_updated_label()}</dt>
				<dd>{mod.updatedAt}</dd>
			{/if}
			{#if mod.language && mod.language !== 'en'}
				<dt>{m.mod_detail_language()}</dt>
				<dd>{mod.language.toUpperCase()}</dd>
			{/if}
			{#if mod.safeToAddMidCampaign}
				<dt>{m.mod_detail_mid_campaign_safety()}</dt>
				<dd class="safety-safe">&#x1f6e1;&#xfe0f; {m.mod_detail_safe_mid_campaign()}</dd>
			{:else}
				<dt>{m.mod_detail_mid_campaign_safety()}</dt>
				<dd class="safety-unsafe">&#x26a0;&#xfe0f; {mod.midCampaignNotes || m.mod_detail_not_safe_mid_campaign()}</dd>
			{/if}
		</dl>
	</div>

	{#if mod.campaigns.length > 0}
		<div class="meta-section span-2">
			<h3>{m.mod_detail_campaigns()}</h3>
			<ul class="tag-list">
				{#each mod.campaigns as campaign}
					<li class="badge-outline">{resolveCampaignDisplayName(campaign)}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if mod.requiredProducts.length > 0}
		<div class="meta-section">
			<h3>{m.mod_detail_required_products()}</h3>
			<ul class="tag-list">
				{#each mod.requiredProducts as product}
					<li class="badge-outline">{resolveProductDisplayName(product)}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if mod.optionalProducts && mod.optionalProducts.length > 0}
		<div class="meta-section">
			<h3>{m.mod_detail_optional_products()}</h3>
			<ul class="tag-list">
				{#each mod.optionalProducts as product}
					<li class="badge-outline">{resolveProductDisplayName(product)}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if mod.includedMods && mod.includedMods.length > 0}
		<div class="meta-section">
			<h3>{m.mod_detail_built_from()}</h3>
			<ul class="included-mods-list">
				{#each mod.includedMods as included}
					<li class="included-mod">
						{m.mod_detail_built_from_entry({
							name: included.name,
							version: included.version,
							author: included.author,
						})}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if mod.tags && mod.tags.length > 0}
		<div class="meta-section">
			<h3>{m.mod_detail_tags()}</h3>
			<div class="tag-chips">
				{#each mod.tags as tag}
					<span class="badge">{tag}</span>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.metadata {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-md) var(--spacing-lg);
		margin-top: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}

	@media (min-width: 600px) {
		.metadata {
			grid-template-columns: 1fr 1fr;
		}
	}

	.at-a-glance {
		grid-column: 1 / -1;
	}

	.span-2 {
		grid-column: 1 / -1;
	}

	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--spacing-xs) var(--spacing-md);
		font-size: var(--font-size-sm);
	}

	.facts dt {
		color: var(--color-text-muted);
	}

	.facts dd {
		color: var(--color-text);
	}

	.type-fact {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.type-desc {
		color: var(--color-text-muted);
		line-height: var(--line-height-normal);
	}

	.safety-safe {
		color: var(--color-success);
	}

	.safety-unsafe {
		color: var(--color-error);
	}

	.meta-section h3 {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-bottom: var(--spacing-sm);
		color: var(--color-text-muted);
	}

	.tag-list {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.included-mods-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.included-mod {
		font-size: var(--font-size-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}

	.tag-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}
</style>
