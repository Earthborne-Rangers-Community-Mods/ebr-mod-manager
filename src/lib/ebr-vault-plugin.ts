import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface VaultEntry {
	name: string;
	isDirectory: boolean;
}

export interface EbrVaultPluginDef {
	pickDirectory(): Promise<{ uri: string; name: string | null }>;
	getStoredDirectory(): Promise<{ uri: string | null; name: string | null }>;
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
