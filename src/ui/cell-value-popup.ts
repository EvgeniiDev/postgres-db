import { Notice, setIcon } from 'obsidian';
import { formatValueForPopup } from '../utils/cell-value';

let activePopup: HTMLElement | null = null;
let closeHandler: ((event: MouseEvent) => void) | null = null;
let keyHandler: ((event: KeyboardEvent) => void) | null = null;

export function closeCellValuePopup(): void {
	if (closeHandler) {
		activeDocument.removeEventListener('mousedown', closeHandler, true);
		closeHandler = null;
	}
	if (keyHandler) {
		activeDocument.removeEventListener('keydown', keyHandler, true);
		keyHandler = null;
	}
	activePopup?.remove();
	activePopup = null;
}

export function openCellValuePopup(
	anchor: HTMLElement,
	value: unknown,
): void {
	closeCellValuePopup();

	const fullText = formatValueForPopup(value);
	const popup = activeDocument.body.createDiv({
		cls: 'pg-cell-value-popup',
	});
	activePopup = popup;

	const header = popup.createDiv({ cls: 'pg-cell-value-popup-header' });
	header.createSpan({ cls: 'pg-cell-value-popup-title', text: 'Cell value' });

	const actions = header.createDiv({ cls: 'pg-cell-value-popup-actions' });

	const copyBtn = actions.createEl('button', {
		cls: 'clickable-icon pg-cell-value-popup-copy',
		attr: {
			type: 'button',
			'aria-label': 'Copy value',
			title: 'Copy value',
		},
	});
	setIcon(copyBtn, 'copy');
	copyBtn.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void copyPopupValue(fullText);
	});

	const closeBtn = actions.createEl('button', {
		cls: 'clickable-icon pg-cell-value-popup-close',
		attr: {
			type: 'button',
			'aria-label': 'Close',
			title: 'Close',
		},
	});
	setIcon(closeBtn, 'x');
	closeBtn.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		closeCellValuePopup();
	});

	popup.createEl('pre', {
		cls: 'pg-cell-value-popup-content',
		text: fullText,
	});

	positionPopup(popup, anchor);

	closeHandler = (event: MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}
		if (!popup.contains(target) && target !== anchor) {
			closeCellValuePopup();
		}
	};

	keyHandler = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			closeCellValuePopup();
		}
	};

	window.requestAnimationFrame(() => {
		if (closeHandler) {
			activeDocument.addEventListener('mousedown', closeHandler, true);
		}
		if (keyHandler) {
			activeDocument.addEventListener('keydown', keyHandler, true);
		}
	});
}

function positionPopup(popup: HTMLElement, anchor: HTMLElement): void {
	const rect = anchor.getBoundingClientRect();
	const margin = 8;
	const gap = 4;

	popup.setCssProps({
		left: `${rect.left}px`,
		top: `${rect.bottom + gap}px`,
	});

	const popupRect = popup.getBoundingClientRect();

	let top = rect.bottom + gap;
	if (popupRect.bottom > window.innerHeight - margin) {
		const aboveTop = rect.top - popupRect.height - gap;
		if (aboveTop >= margin) {
			top = aboveTop;
		} else {
			top = Math.max(
				margin,
				window.innerHeight - popupRect.height - margin,
			);
		}
	}

	let left = rect.left;
	if (left + popupRect.width > window.innerWidth - margin) {
		left = Math.max(margin, window.innerWidth - popupRect.width - margin);
	}
	if (left < margin) {
		left = margin;
	}

	popup.setCssProps({
		left: `${left}px`,
		top: `${top}px`,
	});
}

async function copyPopupValue(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		new Notice('Cell value copied to clipboard.');
	} catch {
		new Notice('Could not copy cell value to clipboard.');
	}
}
