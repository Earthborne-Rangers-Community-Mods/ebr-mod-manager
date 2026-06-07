import { describe, it, expect } from 'vitest';
import {
	NetworkError,
	VaultQuotaExceededError,
	VaultPermissionError,
	isNetworkError,
	isQuotaError,
	isPermissionError,
} from '$lib/errors.js';

// --- isNetworkError ---

describe('isNetworkError', () => {
	it('returns true for a NetworkError instance', () => {
		expect(isNetworkError(new NetworkError('offline'))).toBe(true);
	});

	it('returns true for TypeError("Failed to fetch") - Chrome wording', () => {
		expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
	});

	it('returns true for TypeError("Load failed") - Safari wording', () => {
		expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
	});

	it('returns true for TypeError("NetworkError when attempting to fetch resource") - Firefox wording', () => {
		expect(isNetworkError(new TypeError('NetworkError when attempting to fetch resource'))).toBe(true);
	});

	it('returns false for DOMException AbortError (user-initiated cancel)', () => {
		const err = new DOMException('The operation was aborted.', 'AbortError');
		expect(isNetworkError(err)).toBe(false);
	});

	it('returns false for a plain Error', () => {
		expect(isNetworkError(new Error('something went wrong'))).toBe(false);
	});

	it('returns false for a TypeError unrelated to network (e.g. null dereference)', () => {
		expect(isNetworkError(new TypeError('Cannot read properties of null'))).toBe(false);
	});

	it('returns false for null', () => {
		expect(isNetworkError(null)).toBe(false);
	});

	it('returns false for a plain string', () => {
		expect(isNetworkError('network error')).toBe(false);
	});
});

// --- isQuotaError ---

describe('isQuotaError', () => {
	it('returns true for VaultQuotaExceededError', () => {
		expect(isQuotaError(new VaultQuotaExceededError())).toBe(true);
	});

	it('returns true for DOMException with name QuotaExceededError', () => {
		const err = new DOMException('Storage quota exceeded', 'QuotaExceededError');
		expect(isQuotaError(err)).toBe(true);
	});

	it('returns true for DOMException AbortError with "quota" in message', () => {
		// Edge case: some older browsers throw AbortError with a quota message
		const err = new DOMException('quota exceeded during write', 'AbortError');
		expect(isQuotaError(err)).toBe(true);
	});

	it('returns false for DOMException AbortError without "quota" in message', () => {
		const err = new DOMException('The operation was aborted.', 'AbortError');
		expect(isQuotaError(err)).toBe(false);
	});

	it('returns true for Error with "quota" in message', () => {
		expect(isQuotaError(new Error('storage quota exceeded'))).toBe(true);
	});

	it('returns true for Error with "no space" in message', () => {
		expect(isQuotaError(new Error('no space left on device'))).toBe(true);
	});

	it('returns true for Error with "disk full" in message', () => {
		expect(isQuotaError(new Error('disk full'))).toBe(true);
	});

	it('returns false for a plain Error without a quota-related message', () => {
		expect(isQuotaError(new Error('something else went wrong'))).toBe(false);
	});

	it('returns false for null', () => {
		expect(isQuotaError(null)).toBe(false);
	});

	it('returns false for a DOMException with an unrelated name', () => {
		const err = new DOMException('Not allowed', 'NotAllowedError');
		expect(isQuotaError(err)).toBe(false);
	});
});

// --- isPermissionError ---

describe('isPermissionError', () => {
	it('returns true for VaultPermissionError', () => {
		expect(isPermissionError(new VaultPermissionError())).toBe(true);
	});

	it('returns true for DOMException with name NotAllowedError', () => {
		const err = new DOMException('Permission denied', 'NotAllowedError');
		expect(isPermissionError(err)).toBe(true);
	});

	it('returns true for DOMException with name SecurityError', () => {
		const err = new DOMException('Blocked by security policy', 'SecurityError');
		expect(isPermissionError(err)).toBe(true);
	});

	it('returns false for DOMException with an unrelated name', () => {
		const err = new DOMException('Storage quota exceeded', 'QuotaExceededError');
		expect(isPermissionError(err)).toBe(false);
	});

	it('returns true for Error with "permission" in message', () => {
		expect(isPermissionError(new Error('permission denied'))).toBe(true);
	});

	it('returns true for Error with "not allowed" in message', () => {
		expect(isPermissionError(new Error('operation not allowed by user'))).toBe(true);
	});

	it('returns false for a plain Error without a permission-related message', () => {
		expect(isPermissionError(new Error('something else happened'))).toBe(false);
	});

	it('returns false for null', () => {
		expect(isPermissionError(null)).toBe(false);
	});

	it('returns false for DOMException AbortError', () => {
		const err = new DOMException('The operation was aborted.', 'AbortError');
		expect(isPermissionError(err)).toBe(false);
	});
});
