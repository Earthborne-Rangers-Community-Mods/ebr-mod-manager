import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface VaultEntry {
	name: string;
	isDirectory: boolean;
}

export interface EbrVaultPluginDef {
	/**
	 * Open the system directory picker so the user can choose a vault folder.
	 * On Android the picker is pre-navigated to the last-used directory (an
	 * internal seed hint, never surfaced as a writable reference). The chosen
	 * directory is held for the current session's writes; a fresh pickDirectory()
	 * call is required before writing again after the app process restarts.
	 */
	pickDirectory(): Promise<{ uri: string; name: string | null }>;
	/**
	 * Return a *writable* directory reference if this platform persists one
	 * across sessions, else `{ uri: null, name: null }`. Callers never need to
	 * know which platform they are on: a non-null uri may be reused directly for
	 * writes; a null uri means a fresh pickDirectory() is required first.
	 * - iOS: returns a security-scoped bookmark reused directly for all writes.
	 * - Android: always null. Android does not persist SAF write access, so a
	 *   fresh pickDirectory() is always required before writing.
	 */
	getWritableDirectory(): Promise<{ uri: string | null; name: string | null }>;
	listVaultContents(): Promise<{ entries: VaultEntry[] }>;
	writeFile(options: { path: string; data: string }): Promise<void>;
	clearVaultContents(): Promise<void>;
	addListener(
		eventName: 'clearProgress',
		listener: (data: { deleted: number; total: number }) => void,
	): Promise<PluginListenerHandle>;
}

const EbrVaultPlugin = registerPlugin<EbrVaultPluginDef>('EbrVaultPlugin');
export default EbrVaultPlugin;
