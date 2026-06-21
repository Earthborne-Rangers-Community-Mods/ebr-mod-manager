// Ambient declaration for markdown-it-task-lists, which ships no types and has
// no @types package. Mirrors the plugin's actual shape: a markdown-it plugin
// function that takes an options object.
declare module 'markdown-it-task-lists' {
	import type MarkdownIt from 'markdown-it';

	interface TaskListsOptions {
		enabled?: boolean;
		label?: boolean;
		labelAfter?: boolean;
	}

	const taskLists: (md: MarkdownIt, options?: TaskListsOptions) => void;
	export default taskLists;
}
