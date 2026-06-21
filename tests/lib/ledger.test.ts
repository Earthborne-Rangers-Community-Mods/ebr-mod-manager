// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	getLedger,
	getLedgerEntry,
	entryFor,
	recordDownload,
	hasUpdate,
	compareVersions,
	type DownloadLedger,
} from '$lib/ledger.js';

const LEDGER_KEY = 'ebr-download-ledger';

beforeEach(() => {
	localStorage.clear();
	vi.useRealTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('getLedger', () => {
	it('returns an empty object when nothing is stored', () => {
		expect(getLedger()).toEqual({});
	});

	it('parses a stored ledger', () => {
		localStorage.setItem(
			LEDGER_KEY,
			JSON.stringify({ 'mod-a': { version: '1.0.0', downloadedAt: '2026-01-01T00:00:00.000Z' } }),
		);
		expect(getLedger()).toEqual({
			'mod-a': { version: '1.0.0', downloadedAt: '2026-01-01T00:00:00.000Z' },
		});
	});

	it('returns an empty object on corrupt JSON', () => {
		localStorage.setItem(LEDGER_KEY, '{not valid json');
		expect(getLedger()).toEqual({});
	});

	it('returns an empty object when localStorage.getItem throws', () => {
		const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
			throw new Error('permission denied');
		});
		expect(getLedger()).toEqual({});
		spy.mockRestore();
	});

	it('returns an empty object when the stored value is an array', () => {
		localStorage.setItem(LEDGER_KEY, JSON.stringify(['nope']));
		expect(getLedger()).toEqual({});
	});

	it('returns an empty object when the stored value is a primitive', () => {
		localStorage.setItem(LEDGER_KEY, JSON.stringify('42'));
		expect(getLedger()).toEqual({});
	});

	it('drops entries with the wrong shape but keeps valid ones', () => {
		localStorage.setItem(
			LEDGER_KEY,
			JSON.stringify({
				good: { version: '2.0.0', downloadedAt: '2026-02-02T00:00:00.000Z' },
				missingDate: { version: '1.0.0' },
				wrongType: { version: 3, downloadedAt: '2026-02-02T00:00:00.000Z' },
				notObject: 'x',
				nullEntry: null,
			}),
		);
		expect(getLedger()).toEqual({
			good: { version: '2.0.0', downloadedAt: '2026-02-02T00:00:00.000Z' },
		});
	});
});

describe('prototype pollution', () => {
	it('does not pollute the prototype when a stored key is __proto__', () => {
		localStorage.setItem(
			LEDGER_KEY,
			'{"__proto__": { "version": "9.9.9", "downloadedAt": "2026-01-01T00:00:00.000Z" }}',
		);
		const ledger = getLedger();
		expect(({} as Record<string, unknown>).version).toBeUndefined();
		expect(Object.getPrototypeOf(ledger)).toBe(Object.prototype);
		expect(Object.prototype.hasOwnProperty.call(ledger, '__proto__')).toBe(false);
	});

	it('drops reserved keys (constructor, prototype) during hydration', () => {
		localStorage.setItem(
			LEDGER_KEY,
			JSON.stringify({
				constructor: { version: '1.0.0', downloadedAt: '2026-01-01T00:00:00.000Z' },
				prototype: { version: '1.0.0', downloadedAt: '2026-01-01T00:00:00.000Z' },
				good: { version: '1.0.0', downloadedAt: '2026-01-01T00:00:00.000Z' },
			}),
		);
		expect(getLedger()).toEqual({
			good: { version: '1.0.0', downloadedAt: '2026-01-01T00:00:00.000Z' },
		});
	});

	it('recordDownload ignores a reserved mod id', () => {
		recordDownload('__proto__', '1.0.0');
		expect(getLedger()).toEqual({});
		expect(({} as Record<string, unknown>).version).toBeUndefined();
	});
});

describe('entryFor', () => {
	it('returns null for a reserved key even though it exists on the prototype chain', () => {
		expect(entryFor({}, '__proto__')).toBeNull();
		expect(entryFor({}, 'constructor')).toBeNull();
		expect(entryFor({}, 'prototype')).toBeNull();
	});

	it('returns null for a reserved key that is an own property of the ledger', () => {
		// isReservedKey must fire before Object.hasOwn so a direct bracket assign
		// that slipped through cannot surface a reserved key as an entry.
		const ledger = Object.assign(Object.create(null), {
			constructor: { version: '1.0.0', downloadedAt: '2026-01-01T00:00:00.000Z' },
		}) as DownloadLedger;
		expect(entryFor(ledger, 'constructor')).toBeNull();
	});

	it('returns null for an id that is not an own property', () => {
		expect(entryFor({}, 'missing')).toBeNull();
	});

	it('returns the entry for an own id', () => {
		const entry = { version: '1.0.0', downloadedAt: '2026-01-01T00:00:00.000Z' };
		expect(entryFor({ 'mod-a': entry }, 'mod-a')).toEqual(entry);
	});
});

describe('getLedgerEntry', () => {
	it('returns null for an unknown mod', () => {
		expect(getLedgerEntry('missing')).toBeNull();
	});

	it('returns null for a reserved mod id', () => {
		expect(getLedgerEntry('__proto__')).toBeNull();
	});

	it('returns the entry for a known mod', () => {
		recordDownload('mod-a', '1.2.3');
		expect(getLedgerEntry('mod-a')?.version).toBe('1.2.3');
	});
});

describe('recordDownload', () => {
	it('writes a new entry with version and ISO timestamp', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-20T12:00:00.000Z'));
		recordDownload('mod-a', '1.0.0');
		expect(getLedgerEntry('mod-a')).toEqual({
			version: '1.0.0',
			downloadedAt: '2026-06-20T12:00:00.000Z',
		});
	});

	it('overwrites an existing entry (clears the badge)', () => {
		recordDownload('mod-a', '1.0.0');
		recordDownload('mod-a', '2.0.0');
		expect(getLedgerEntry('mod-a')?.version).toBe('2.0.0');
	});

	it('preserves other entries when recording one mod', () => {
		recordDownload('mod-a', '1.0.0');
		recordDownload('mod-b', '3.0.0');
		const ledger = getLedger();
		expect(Object.keys(ledger).sort()).toEqual(['mod-a', 'mod-b']);
	});

	it('does not throw when localStorage.setItem is unavailable', () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
			throw new DOMException('QuotaExceededError');
		});
		expect(() => recordDownload('mod-a', '1.0.0')).not.toThrow();
		spy.mockRestore();
	});
});

describe('compareVersions', () => {
	it('returns 0 for equal versions', () => {
		expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
	});

	it('returns 1 when the first is a higher patch', () => {
		expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
	});

	it('returns -1 when the first is a lower minor', () => {
		expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
	});

	it('compares major before minor before patch', () => {
		expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
	});

	it('treats missing components as zero', () => {
		expect(compareVersions('1', '1.0.0')).toBe(0);
		expect(compareVersions('1.2', '1.2.0')).toBe(0);
	});

	it('ignores a leading v', () => {
		expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
	});

	it('ignores a leading uppercase V', () => {
		expect(compareVersions('V1.2.0', '1.2.0')).toBe(0);
	});

	it('ignores pre-release and build metadata', () => {
		expect(compareVersions('1.2.0-beta.1', '1.2.0')).toBe(0);
		expect(compareVersions('1.2.0+build5', '1.2.0')).toBe(0);
	});

	it('treats unparseable components as zero', () => {
		expect(compareVersions('x.y.z', '0.0.0')).toBe(0);
	});
});

describe('hasUpdate', () => {
	it('returns false for a mod that was never downloaded', () => {
		expect(hasUpdate('mod-a', '1.0.0')).toBe(false);
	});

	it('returns true when the registry version is ahead of the ledger', () => {
		recordDownload('mod-a', '1.0.0');
		expect(hasUpdate('mod-a', '1.1.0')).toBe(true);
	});

	it('returns false when the versions match', () => {
		recordDownload('mod-a', '1.0.0');
		expect(hasUpdate('mod-a', '1.0.0')).toBe(false);
	});

	it('returns false when the ledger is ahead of the registry (rollback)', () => {
		recordDownload('mod-a', '2.0.0');
		expect(hasUpdate('mod-a', '1.0.0')).toBe(false);
	});
});
