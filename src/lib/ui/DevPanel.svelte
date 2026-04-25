<script lang="ts">
	import { getToken, setToken, clearToken } from '$lib/devsettings.js';
	import * as m from '$lib/paraglide/messages.js';

	let tokenInput = $state(getToken() ?? '');
	let saved = $state(false);
	let hasToken = $state(!!getToken());

	function handleSave() {
		const trimmed = tokenInput.trim();
		if (trimmed) {
			setToken(trimmed);
		} else {
			clearToken();
		}
		hasToken = !!getToken();
		saved = true;
		setTimeout(() => (saved = false), 1500);
	}

	function handleClear() {
		clearToken();
		tokenInput = '';
		hasToken = false;
		saved = false;
	}

	let { onclose }: { onclose: () => void } = $props();
</script>

<aside class="dev-panel">
	<div class="dev-header">
		<span class="dev-title">Dev Panel</span>
		<button class="dev-close" onclick={onclose}>X</button>
	</div>
	<p class="dev-explanation">
		{m.dev_panel_explanation()}
	</p>
	<div class="dev-body">
		<label class="dev-label">
			GitHub Token
			<p class="dev-hint">
				A fine-grained PAT with read-only Contents access to the mod repo.
				Create one at
				<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">
					github.com/settings/personal-access-tokens/new</a>
				- select "Only select repositories", pick the mod repo, and set Contents to Read-only.
			</p>
			<div class="token-row">
				<input
					type="password"
					class="dev-input"
					placeholder="github_pat_..."
					bind:value={tokenInput}
				/>
				<button class="dev-btn" onclick={handleSave}>Save</button>
				<button class="dev-btn secondary" onclick={handleClear}>Clear</button>
			</div>
			{#if saved}
				<span class="dev-saved">Saved</span>
			{/if}
			{#if hasToken}
				<span class="dev-status set">Token set</span>
			{:else}
				<span class="dev-status unset">No token</span>
			{/if}
		</label>
	</div>
</aside>

<style>
	.dev-panel {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--color-surface);
		border-top: 2px solid var(--color-primary);
		padding: 0.75rem 1rem;
		z-index: 1000;
		font-size: 0.8125rem;
	}

	.dev-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.dev-title {
		font-weight: 700;
		color: var(--color-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.dev-close {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0.125rem 0.375rem;
		min-height: auto;
	}

	.dev-close:hover {
		color: var(--color-text);
	}

	.dev-explanation {
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.4;
		margin-bottom: 0.5rem;
	}

	.dev-label {
		display: block;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.dev-hint {
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		line-height: 1.4;
		margin: 0.25rem 0;
	}

	.dev-hint a {
		color: var(--color-primary);
	}

	.token-row {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.25rem;
		align-items: center;
	}

	.dev-input {
		font: inherit;
		font-size: 0.8125rem;
		padding: 0.3125rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		color: var(--color-text);
		flex: 1;
		max-width: 20rem;
	}

	.dev-btn {
		font-size: 0.75rem;
		padding: 0.3125rem 0.625rem;
		min-height: auto;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.dev-btn.secondary {
		background: var(--color-border);
		color: var(--color-text-muted);
	}

	.dev-btn:hover {
		opacity: 0.85;
	}

	.dev-saved {
		color: #2a9d2a;
		margin-left: 0.5rem;
		font-size: 0.75rem;
	}

	.dev-status {
		display: inline-block;
		margin-top: 0.25rem;
		font-size: 0.6875rem;
	}

	.dev-status.set {
		color: #2a9d2a;
	}

	.dev-status.unset {
		color: var(--color-text-muted);
	}
</style>
