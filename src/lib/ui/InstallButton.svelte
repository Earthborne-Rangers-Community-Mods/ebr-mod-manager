<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { downloadModZip, type DownloadProgress } from '$lib/download.js';
	import { extractModZipAsync, repackageModZipAsync } from '$lib/extraction.js';
	import {
		getInstallMethod,
		isAndroidBrowser,
		pickVaultTarget,
		checkVault,
		clearVault,
		writeVaultFiles,
		setInstalledMod,
	} from '$lib/vault.js';
	import { PathTraversalError, ModDownloadError, VaultDirectoryMissingError } from '$lib/errors.js';
	import { getToken } from '$lib/devsettings.js';
	import type { ModDetail } from '$lib/registry.js';

	interface Props {
		mod: ModDetail;
	}

	let { mod }: Props = $props();

	type InstallState =
		| { step: 'idle' }
		| { step: 'downloading'; progress: DownloadProgress | null }
		| { step: 'writing'; message: string }
		| { step: 'complete' }
		| { step: 'error'; message: string };

	let state = $state<InstallState>({ step: 'idle' });

	async function handleDownload() {
		if (state.step === 'downloading' || state.step === 'writing') return;
		state = { step: 'downloading', progress: null };

		try {
			const token = getToken() ?? undefined;
			const method = getInstallMethod();

			if (method === 'vault-write') {
				const target = await pickVaultTarget(mod.id);
				const status = await checkVault(target);

				if (status === 'unrecognized') {
					state = { step: 'error', message: m.error_vault_safety() };
					return;
				}

				if (status === 'existing-vault') {
					const ok = confirm(m.confirm_replace_vault({ modName: mod.name }));
					if (!ok) {
						state = { step: 'idle' };
						return;
					}
				}

				const zipBuffer = await downloadModZip(mod, {
					token,
					onProgress: (p) => {
						state = { step: 'downloading', progress: p };
					},
				});

				state = { step: 'writing', message: m.extracting_mod() };
				const files = await extractModZipAsync(zipBuffer);

				state = { step: 'writing', message: m.clearing_vault() };
				await clearVault(target, {
					onProgress: (deleted, total) => {
						state = { step: 'writing', message: m.clearing_vault_progress({ deleted, total }) };
					},
				});
				state = { step: 'writing', message: m.writing_vault_progress({ written: 0, total: files.length }) };
				await writeVaultFiles(target, files, {
					onProgress: (written, total) => {
						state = { step: 'writing', message: m.writing_vault_progress({ written, total }) };
					},
				});

				setInstalledMod({
					id: mod.id,
					name: mod.name,
					version: mod.latestVersion,
					commitHash: mod.commitHash,
				});

				state = { step: 'complete' };
			} else {
				const zipBuffer = await downloadModZip(mod, {
					token,
					onProgress: (p) => {
						state = { step: 'downloading', progress: p };
					},
				});

				const cleanZip = await repackageModZipAsync(zipBuffer);
				const blob = new Blob([cleanZip as BlobPart], { type: 'application/zip' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${mod.id}.zip`;
				a.click();
				URL.revokeObjectURL(url);
				state = { step: 'complete' };
			}
		} catch (err) {
			console.error('Mod install failed:', err);
			if (err instanceof PathTraversalError) {
				state = { step: 'error', message: m.error_extraction_security() };
			} else if (err instanceof VaultDirectoryMissingError) {
				state = { step: 'error', message: m.error_vault_removed() };
			} else if (err instanceof DOMException && err.name === 'AbortError') {
				state = { step: 'idle' };
			} else if (err instanceof ModDownloadError) {
				if (err.httpStatus >= 500) {
					state = { step: 'error', message: m.error_download_server() };
				} else if (err.httpStatus === 404 || err.httpStatus === 403) {
					state = { step: 'error', message: m.error_download_not_found() };
				} else {
					state = { step: 'error', message: m.error_download_failed() };
				}
			} else if (err instanceof TypeError && err.message.includes('fetch')) {
				state = { step: 'error', message: m.error_download_network() };
			} else {
				state = { step: 'error', message: m.error_download_failed() };
			}
		}
	}
</script>

<div class="install-section">
	{#if isAndroidBrowser()}
		<span class="android-browser-message">{m.android_browser_install_blocked()}</span>
	{:else if state.step === 'downloading'}
		<button class="install-button" disabled>
			{m.downloading()}
			{#if state.progress}
				{#if state.progress.totalBytes}
					({Math.round((state.progress.receivedBytes / state.progress.totalBytes) * 100)}%)
				{:else}
					({(state.progress.receivedBytes / 1024).toFixed(0)} KB)
				{/if}
			{/if}
		</button>
	{:else if state.step === 'writing'}
		<button class="install-button" disabled>
			{state.message}
		</button>
	{:else if state.step === 'complete'}
		<span class="download-success">{m.vault_write_complete()}</span>
	{:else}
		<button class="install-button" onclick={handleDownload}>
			{m.install_button()}
		</button>
	{/if}
	{#if state.step === 'error'}
		<span class="download-error">{state.message}</span>
	{/if}
</div>

<style>
	.install-section {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex-shrink: 0;
	}

	.install-button {
		font-size: var(--font-size-base);
		padding: var(--spacing-sm) var(--spacing-xl);
		min-height: 2.75rem;
		background: var(--color-primary);
		color: var(--color-primary-text);
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 600;
		transition: background var(--transition-fast), transform var(--transition-fast);
		touch-action: manipulation;
	}

	.install-button:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	.install-button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.install-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.download-success {
		font-size: var(--font-size-sm);
		color: var(--color-success);
		font-weight: 500;
	}

	.download-error {
		font-size: var(--font-size-sm);
		color: var(--color-error);
	}

	.android-browser-message {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-style: italic;
	}
</style>
