import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { Editor, EditorPosition } from 'obsidian';
import {
	isInsideFencedCodeBlockFromLines,
	isInsideSqlBlockFromLines,
} from './sql-code-context';

function getEditorView(editor: Editor): EditorView | null {
	const candidate = editor as Editor & { cm?: EditorView };
	return candidate.cm ?? null;
}

function editorPositionToOffset(
	editor: Editor,
	pos: EditorPosition,
): number {
	if (typeof editor.posToOffset === 'function') {
		return editor.posToOffset(pos);
	}

	let offset = 0;
	for (let line = 0; line < pos.line; line++) {
		offset += editor.getLine(line).length + 1;
	}
	return offset + pos.ch;
}

function isSqlCodeBlockNode(
	state: EditorState,
	node: ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>,
): boolean {
	const infoNode = node.getChild('CodeInfo');
	if (infoNode) {
		const lang = state
			.sliceDoc(infoNode.from, infoNode.to)
			.trim()
			.split(/\s+/)[0]
			?.toLowerCase();
		return lang === 'sql';
	}

	return /sql/i.test(node.name);
}

export function isInsideSqlCodeBlockSyntaxTree(
	state: EditorState,
	pos: number,
): boolean {
	const tree = syntaxTree(state);
	let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(
		pos,
		-1,
	);

	while (node) {
		if (/FencedCode|CodeBlock|codeblock/i.test(node.name)) {
			return isSqlCodeBlockNode(state, node);
		}
		if (node.name === 'CodeText') {
			const parent = node.parent;
			if (parent && /FencedCode|CodeBlock|codeblock/i.test(parent.name)) {
				return isSqlCodeBlockNode(state, parent);
			}
		}
		node = node.parent;
	}

	return false;
}

function isInsideSqlCodeBlockDom(editor: Editor): boolean {
	const view = getEditorView(editor);
	const root = view?.dom;
	if (!root) {
		return false;
	}

	if (
		root.closest(
			'[data-block-language="sql"], .block-language-sql, .cm-lang-sql',
		)
	) {
		return true;
	}

	const codeBlock = root.closest('.HyperMD-codeblock');
	return codeBlock?.classList.contains('cm-lang-sql') ?? false;
}

export function isInsideFencedCodeBlock(
	state: EditorState,
	pos: number,
): boolean {
	const line = state.doc.lineAt(pos);
	return isInsideFencedCodeBlockFromLines(
		(index) => state.doc.line(index + 1).text,
		line.number - 1,
	);
}

export function isInsideSqlCodeBlock(
	state: EditorState,
	pos: number,
): boolean {
	const line = state.doc.lineAt(pos);
	return isInsideSqlBlockFromLines(
		(index) => state.doc.line(index + 1).text,
		line.number - 1,
	);
}

export function isInsideSqlCodeBlockEditor(
	editor: Editor,
	cursor: EditorPosition,
): boolean {
	if (
		isInsideSqlBlockFromLines(
			(index) => editor.getLine(index),
			cursor.line,
		)
	) {
		return true;
	}

	const view = getEditorView(editor);
	if (view) {
		const offset = editorPositionToOffset(editor, cursor);
		if (isInsideSqlCodeBlockSyntaxTree(view.state, offset)) {
			return true;
		}
	}

	return isInsideSqlCodeBlockDom(editor);
}

export function isInsideFencedCodeBlockSyntaxTree(
	state: EditorState,
	pos: number,
): boolean {
	const tree = syntaxTree(state);
	let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(
		pos,
		-1,
	);
	while (node) {
		if (/codeblock|CodeBlock|FencedCode/i.test(node.name)) {
			return true;
		}
		node = node.parent;
	}
	return false;
}
