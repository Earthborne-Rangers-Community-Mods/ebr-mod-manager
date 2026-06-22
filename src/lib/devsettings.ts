import { getStorageItem, setStorageItem, removeStorageItem } from '$lib/safe-storage.js';

const TOKEN_KEY = 'ebr_github_token';
const BASE_CONTENT_TOKEN_KEY = 'ebr_github_base_content_token';
const DEV_PANEL_KEY = 'ebr_dev_panel';

export function getToken(): string | null {
	return getStorageItem(TOKEN_KEY);
}

export function setToken(token: string): void {
	setStorageItem(TOKEN_KEY, token);
}

export function clearToken(): void {
	removeStorageItem(TOKEN_KEY);
}

/**
 * Token used to fetch resources from the canonical
 * Earthborne-Rangers-Community-Mods/ebr-mod-base-content repo (currently
 * private). Distinct from the per-mod token because it requires
 * organization-level approval / SSO authorization.
 */
export function getBaseContentToken(): string | null {
	return getStorageItem(BASE_CONTENT_TOKEN_KEY);
}

export function setBaseContentToken(token: string): void {
	setStorageItem(BASE_CONTENT_TOKEN_KEY, token);
}

export function clearBaseContentToken(): void {
	removeStorageItem(BASE_CONTENT_TOKEN_KEY);
}

export function isDevPanelOpen(): boolean {
	return getStorageItem(DEV_PANEL_KEY) === 'true';
}

export function setDevPanelOpen(open: boolean): void {
	if (open) {
		setStorageItem(DEV_PANEL_KEY, 'true');
	} else {
		removeStorageItem(DEV_PANEL_KEY);
	}
}
