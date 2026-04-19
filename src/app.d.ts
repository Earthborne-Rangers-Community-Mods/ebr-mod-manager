// See https://svelte.dev/docs/kit/types#app.d.ts

// For more information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// File System Access API types (not yet in default TypeScript lib)
	interface FileSystemDirectoryHandle {
		readonly kind: 'directory';
		readonly name: string;
		getFileHandle(
			name: string,
			options?: { create?: boolean },
		): Promise<FileSystemFileHandle>;
		getDirectoryHandle(
			name: string,
			options?: { create?: boolean },
		): Promise<FileSystemDirectoryHandle>;
		values(): AsyncIterableIterator<FileSystemHandle>;
	}

	interface FileSystemFileHandle {
		readonly kind: 'file';
		readonly name: string;
		getFile(): Promise<File>;
		createWritable(): Promise<FileSystemWritableFileStream>;
	}

	interface FileSystemWritableFileStream extends WritableStream {
		write(data: string | BufferSource | Blob): Promise<void>;
		close(): Promise<void>;
	}

	interface Window {
		showDirectoryPicker(options?: {
			id?: string;
			mode?: 'read' | 'readwrite';
			startIn?:
				| 'desktop'
				| 'documents'
				| 'downloads'
				| 'music'
				| 'pictures'
				| 'videos';
		}): Promise<FileSystemDirectoryHandle>;
	}
}

export {};
