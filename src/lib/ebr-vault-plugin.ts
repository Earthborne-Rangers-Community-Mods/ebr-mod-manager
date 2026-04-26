import { registerPlugin } from '@capacitor/core';

export interface VaultEntry {
	name: string;
	isDirectory: boolean;
}

export interface EbrVaultPluginDef {
	pickDirectory(): Promise<{ uri: string }>;
	getStoredDirectory(): Promise<{ uri: string | null }>;
	listVaultContents(): Promise<{ entries: VaultEntry[] }>;
	writeFile(options: { path: string; data: string }): Promise<void>;
	clearVaultContents(): Promise<void>;
}

const EbrVaultPlugin = registerPlugin<EbrVaultPluginDef>('EbrVaultPlugin');
export default EbrVaultPlugin;
