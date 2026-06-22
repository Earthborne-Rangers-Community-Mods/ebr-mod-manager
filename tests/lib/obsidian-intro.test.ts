// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	hasSeenObsidianIntro,
	markObsidianIntroSeen,
	requestObsidianIntro,
	showObsidianIntro,
	confirmObsidianIntro,
	dismissObsidianIntro,
	obsidianIntroOpen,
} from '$lib/obsidian-intro.js';

describe('seenObsidianIntro flag', () => {
	beforeEach(() => {
		localStorage.clear();
		obsidianIntroOpen.set(false);
	});

	it('reports not seen by default', () => {
		expect(hasSeenObsidianIntro()).toBe(false);
	});

	it('reports seen after marking', () => {
		markObsidianIntroSeen();
		expect(hasSeenObsidianIntro()).toBe(true);
	});

	it('treats a non-"true" stored value as not seen', () => {
		localStorage.setItem('seenObsidianIntro', 'yes');
		expect(hasSeenObsidianIntro()).toBe(false);
	});

	it('returns false when localStorage.getItem throws', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
			throw new Error('storage unavailable');
		});
		expect(hasSeenObsidianIntro()).toBe(false);
	});

	it('does not throw and flag remains unset when localStorage.setItem throws', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
			throw new Error('storage full');
		});
		expect(() => markObsidianIntroSeen()).not.toThrow();
		// setItem failed, so the flag was never written -- reads back as not seen.
		expect(hasSeenObsidianIntro()).toBe(false);
	});
});

describe('requestObsidianIntro', () => {
	beforeEach(() => {
		localStorage.clear();
		obsidianIntroOpen.set(false);
	});

	it('runs the continuation immediately and stays closed when already seen', () => {
		markObsidianIntroSeen();
		const onProceed = vi.fn();
		requestObsidianIntro(onProceed);
		expect(onProceed).toHaveBeenCalledTimes(1);
		expect(get(obsidianIntroOpen)).toBe(false);
	});

	it('opens the explainer and defers the continuation when not yet seen', () => {
		const onProceed = vi.fn();
		requestObsidianIntro(onProceed);
		expect(onProceed).not.toHaveBeenCalled();
		expect(get(obsidianIntroOpen)).toBe(true);
	});
});

describe('confirmObsidianIntro', () => {
	beforeEach(() => {
		localStorage.clear();
		obsidianIntroOpen.set(false);
	});

	it('marks seen, closes, and runs the deferred continuation', () => {
		const onProceed = vi.fn();
		requestObsidianIntro(onProceed);
		confirmObsidianIntro();
		expect(hasSeenObsidianIntro()).toBe(true);
		expect(get(obsidianIntroOpen)).toBe(false);
		expect(onProceed).toHaveBeenCalledTimes(1);
	});

	it('does not run a continuation when opened informationally', () => {
		const onProceed = vi.fn();
		requestObsidianIntro(onProceed);
		// A second, informational open clears the pending continuation.
		showObsidianIntro();
		confirmObsidianIntro();
		expect(onProceed).not.toHaveBeenCalled();
		expect(get(obsidianIntroOpen)).toBe(false);
	});
});

describe('dismissObsidianIntro', () => {
	beforeEach(() => {
		localStorage.clear();
		obsidianIntroOpen.set(false);
	});

	it('closes without marking seen or running the continuation', () => {
		const onProceed = vi.fn();
		requestObsidianIntro(onProceed);
		dismissObsidianIntro();
		// Dismissal is not the explicit "I already have it" path, so the explainer
		// stays mandatory: the next download attempt shows it again.
		expect(hasSeenObsidianIntro()).toBe(false);
		expect(get(obsidianIntroOpen)).toBe(false);
		expect(onProceed).not.toHaveBeenCalled();
	});

	it('clears the pending continuation so a later confirm does not fire it', () => {
		const onProceed = vi.fn();
		requestObsidianIntro(onProceed);
		dismissObsidianIntro();
		confirmObsidianIntro();
		expect(onProceed).not.toHaveBeenCalled();
	});
});
