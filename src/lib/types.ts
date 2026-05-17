export type ModType =
	| 'campaign'
	| 'enhancement'
	| 'one-day-mission'
	| 'expansion'
	| 'collection'
	| 'theme';

/** Browse-tier mod data (from registry.json). */
export interface BrowseMod {
	id: string;
	name: string;
	repoUrl: string;
	type: ModType;
	commitHash: string;
	author: string;
	description: string;
	tags: string[];
	campaigns: string[];
	requiredProducts: string[];
	safeToAddMidCampaign: boolean;
	icon?: string;
	language: string;
	latestVersion: string;
	updatedAt: string;
}

/** Included mod reference (for collections and lineage). */
export interface IncludedMod {
	id: string;
	name: string;
	author: string;
	version: string;
	repoUrl: string;
}

/** Detail-tier mod data (from mods/<mod-id>.json). */
export interface ModDetail extends BrowseMod {
	authorDiscord?: string;
	midCampaignNotes?: string;
	optionalProducts?: string[];
	includedMods?: IncludedMod[];
}

/** The combined registry.json structure. */
export interface Registry {
	schemaVersion: number;
	mods: BrowseMod[];
}
