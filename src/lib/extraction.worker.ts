import { extractModZip, repackageModZip } from './extraction.js';
import { PathTraversalError, ZipHashMismatchError } from './errors.js';

export type WorkerRequest =
	| { id: number; type: 'extract'; zipBuffer: ArrayBuffer; expectedCommitHash?: string }
	| { id: number; type: 'repackage'; zipBuffer: ArrayBuffer; expectedCommitHash?: string };

export type WorkerResponse =
	| { id: number; type: 'extract'; files: { path: string; data: Uint8Array }[] }
	| { id: number; type: 'repackage'; cleanZip: Uint8Array }
	| { id: number; type: 'error'; errorName: string; message: string; expectedHash?: string; actualHash?: string; filePath?: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
	const msg = e.data;
	try {
		if (msg.type === 'extract') {
			const files = extractModZip(msg.zipBuffer, { expectedCommitHash: msg.expectedCommitHash });
			self.postMessage({ id: msg.id, type: 'extract', files } satisfies WorkerResponse);
		} else if (msg.type === 'repackage') {
			const cleanZip = repackageModZip(msg.zipBuffer, { expectedCommitHash: msg.expectedCommitHash });
			self.postMessage({ id: msg.id, type: 'repackage', cleanZip } satisfies WorkerResponse);
		}
	} catch (err) {
		const errorName = err instanceof Error ? err.name : 'Error';
		const message = err instanceof Error ? err.message : String(err);
		const response: WorkerResponse = { id: msg.id, type: 'error', errorName, message };

		if (err instanceof ZipHashMismatchError) {
			response.expectedHash = err.expectedHash;
			response.actualHash = err.actualHash;
		}
		if (err instanceof PathTraversalError) {
			response.filePath = err.filePath;
		}

		self.postMessage(response);
	}
};
