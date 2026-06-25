import { getStorageItem, setStorageItem, removeStorageItem } from '$lib/safe-storage.js';

const DEV_PANEL_KEY = 'ebr_dev_panel';

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
