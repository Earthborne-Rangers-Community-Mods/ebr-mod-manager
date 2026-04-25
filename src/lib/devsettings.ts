const TOKEN_KEY = 'ebr_github_token';
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
