const TOKEN_KEY = 'ebr_github_token';
const BASE_CONTENT_TOKEN_KEY = 'ebr_github_base_content_token';
const DEV_PANEL_KEY = 'ebr_dev_panel';

export function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
	localStorage.removeItem(TOKEN_KEY);
}

/**
 * Token used to fetch resources from the canonical
 * Earthborne-Rangers-Community-Mods/ebr-mod-base-content repo (currently
 * private). Distinct from the per-mod token because it requires
 * organization-level approval / SSO authorization.
 */
export function getBaseContentToken(): string | null {
	return localStorage.getItem(BASE_CONTENT_TOKEN_KEY);
}

export function setBaseContentToken(token: string): void {
	localStorage.setItem(BASE_CONTENT_TOKEN_KEY, token);
}

export function clearBaseContentToken(): void {
	localStorage.removeItem(BASE_CONTENT_TOKEN_KEY);
}

export function isDevPanelOpen(): boolean {
	return localStorage.getItem(DEV_PANEL_KEY) === 'true';
}

export function setDevPanelOpen(open: boolean): void {
	if (open) {
		localStorage.setItem(DEV_PANEL_KEY, 'true');
	} else {
		localStorage.removeItem(DEV_PANEL_KEY);
	}
}
