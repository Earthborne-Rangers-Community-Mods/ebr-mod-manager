const STORAGE_KEY = 'ebr-theme';

export type Theme = 'light' | 'dark';

let currentTheme: Theme | null = null;

function getSystemTheme(): Theme {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getTheme(): Theme {
	if (currentTheme) return currentTheme;
	if (typeof window === 'undefined') return 'light';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark') {
		currentTheme = stored;
	} else {
		currentTheme = getSystemTheme();
	}
	return currentTheme;
}

export function setTheme(theme: Theme): void {
	currentTheme = theme;
	localStorage.setItem(STORAGE_KEY, theme);
	applyTheme(theme);
}

export function toggleTheme(): void {
	setTheme(getTheme() === 'light' ? 'dark' : 'light');
}

export function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): void {
	const theme = getTheme();
	applyTheme(theme);
}

/**
 * Forget the stored theme preference and fall back to the system theme. The
 * applied theme is updated immediately so the change is visible without a
 * reload.
 */
export function clearStoredTheme(): void {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Storage unavailable -- nothing to clear.
		}
	}
	currentTheme = null;
	applyTheme(getSystemTheme());
}
