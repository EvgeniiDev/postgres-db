import { EditorSelection, Prec, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type PgPlugin from '../main';
import { isInsideFencedCodeBlockSyntaxTree } from './sql-editor-context';

function insertLiteralCharacter(view: EditorView, character: string): boolean {
	const { state } = view;
	const { from, to } = state.selection.main;
	if (!isInsideFencedCodeBlockSyntaxTree(state, from)) {
		return false;
	}

	view.dispatch({
		changes: { from, to, insert: character },
		selection: EditorSelection.cursor(from + character.length),
		userEvent: 'input.type',
	});
	return true;
}

const preventAsteriskPairing: Extension = [
	Prec.highest(
		keymap.of([
			{
				key: '*',
				run: (view) => insertLiteralCharacter(view, '*'),
			},
		]),
	),
	EditorView.inputHandler.of((view, from, to, text) => {
		if (text !== '*') {
			return false;
		}
		if (!isInsideFencedCodeBlockSyntaxTree(view.state, from)) {
			return false;
		}
		view.dispatch({
			changes: { from, to, insert: '*' },
			selection: EditorSelection.cursor(from + 1),
			userEvent: 'input.type',
		});
		return true;
	}),
];

export function registerSqlCodeEditExtension(plugin: PgPlugin): void {
	plugin.registerEditorExtension(preventAsteriskPairing);
}
