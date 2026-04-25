import { extractModZip, repackageModZip } from './extraction.js';

export type WorkerRequest =
	| { id: number; type: 'extract'; zipBuffer: ArrayBuffer }
	| { id: number; type: 'repackage'; zipBuffer: ArrayBuffer };

export type WorkerResponse =
	| { id: number; type: 'extract'; files: { path: string; data: Uint8Array }[] }
	| { id: number; type: 'repackage'; cleanZip: Uint8Array }
	| { id: number; type: 'error'; errorName: string; message: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
	const { id, type, zipBuffer } = e.data;
	try {
		if (type === 'extract') {
			const files = extractModZip(zipBuffer);
			self.postMessage({ id, type: 'extract', files } satisfies WorkerResponse);
		} else if (type === 'repackage') {
			const cleanZip = repackageModZip(zipBuffer);
			self.postMessage({ id, type: 'repackage', cleanZip } satisfies WorkerResponse);
		}
	} catch (err) {
		const errorName = err instanceof Error ? err.name : 'Error';
		const message = err instanceof Error ? err.message : String(err);
		self.postMessage({ id, type: 'error', errorName, message } satisfies WorkerResponse);
	}
};
