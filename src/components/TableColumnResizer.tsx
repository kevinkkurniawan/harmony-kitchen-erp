'use client';

import { useEffect } from 'react';

// v2: widths saved by the old resizer were often broken (80px floor, filter rows counted), so start fresh.
const STORAGE_PREFIX = 'erp-table-widths:v2:';
// When true, data cells are only truncated once the user has set column widths.
const TRUNCATE_ONLY_RESIZED: boolean = false;
const MIN_WIDTH = 40;
const MAX_WIDTH = 700;
const STYLE_ID = 'table-column-resizer-styles';

const TABLE_SELECTOR = 'table[data-column-resize-table]';
const SIZED_SELECTOR = 'table[data-column-resize-sized]';

const RESIZER_CSS = `
${TRUNCATE_ONLY_RESIZED ? SIZED_SELECTOR : TABLE_SELECTOR} > tbody > tr > td {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-column-resize-handle] {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: col-resize;
  z-index: 30;
  touch-action: none;
  user-select: none;
  transition: color .15s;
}
[data-column-resize-handle]:hover,
[data-column-resize-handle][data-active] {
  color: #92400e;
}
body[data-column-resizing],
body[data-column-resizing] * {
  cursor: col-resize !important;
  user-select: none !important;
}
`;

// Base widths per table (without the filler space given to the last column).
const columnWidths = new WeakMap<HTMLTableElement, number[]>();

/** Only the first header row holds column titles; later rows (e.g. ColumnFilterRow) follow its widths. */
function headerCells(table: HTMLTableElement) {
  const row = table.tHead?.rows[0];
  return row ? Array.from(row.cells) : [];
}

function headerLabel(header: HTMLTableCellElement) {
  return Array.from(header.childNodes)
    .filter((node) => !(node instanceof HTMLElement && node.dataset.columnResizeHandle !== undefined))
    .map((node) => node.textContent || '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function tableKey(table: HTMLTableElement) {
  const explicitKey = table.dataset.erpTableId;
  if (explicitKey) return `${STORAGE_PREFIX}${explicitKey}`;
  return `${STORAGE_PREFIX}${headerCells(table).map(headerLabel).join('|')}`;
}

function readWidths(key: string) {
  try {
    const widths = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(widths) && widths.length && widths.every((width) => typeof width === 'number') ? widths as number[] : null;
  } catch {
    return null;
  }
}

function saveWidths(key: string, widths: number[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(widths));
  } catch {
    // Storage can be full or blocked; the widths still apply for this page view.
  }
}

/** Utility columns (row number, checkbox, expand button) keep their width. */
function isUtilityColumn(header: HTMLTableCellElement) {
  const label = headerLabel(header);
  return !label || label === '#' || !!header.querySelector('input[type="checkbox"]');
}

function innerWidth(element: HTMLElement | null) {
  if (!element) return 0;
  const style = getComputedStyle(element);
  return element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
}

function hasScrollingAncestor(table: HTMLTableElement) {
  for (let element = table.parentElement; element && element !== document.body; element = element.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(element).overflowX)) return true;
  }
  return false;
}

function applyWidths(table: HTMLTableElement, widths: number[], fillLast = true) {
  const headers = headerCells(table);
  if (headers.length !== widths.length) return;
  const totalWidth = widths.reduce((total, width) => total + width, 0);
  const tableStyle = getComputedStyle(table);
  const spacing = tableStyle.borderCollapse === 'separate' ? (parseFloat(tableStyle.borderSpacing) || 0) * (headers.length + 1) : 0;
  const containerWidth = innerWidth(table.parentElement);
  // Leftover space goes to the last column only, so the dragged column tracks the pointer exactly.
  const filler = fillLast ? Math.max(0, containerWidth - totalWidth - spacing) : 0;
  const tableWidth = totalWidth + spacing + filler;
  table.style.tableLayout = 'fixed';
  table.style.width = `${tableWidth}px`;
  table.style.minWidth = `${tableWidth}px`;
  headers.forEach((header, index) => {
    const width = widths[index] + (index === headers.length - 1 ? filler : 0);
    header.style.width = `${width}px`;
    header.style.minWidth = '';
  });
  table.dataset.columnResizeSized = 'true';
  // Making the parent scroll would also make it the sticky header's scroll box, so reuse an existing scroller.
  if (table.parentElement && !hasScrollingAncestor(table)) table.parentElement.style.overflowX = 'auto';
}

function clearWidths(table: HTMLTableElement) {
  table.style.tableLayout = '';
  table.style.width = '';
  table.style.minWidth = '';
  headerCells(table).forEach((header) => {
    header.style.width = '';
    header.style.minWidth = '';
  });
  delete table.dataset.columnResizeSized;
  columnWidths.delete(table);
}

function startingWidths(table: HTMLTableElement, headers: HTMLTableCellElement[]) {
  const stored = columnWidths.get(table);
  if (stored?.length === headers.length) return [...stored];
  return headers.map((header) => Math.max(1, Math.round(header.getBoundingClientRect().width)));
}

/** Widest content in the column, measured with the column squeezed to MIN_WIDTH. */
function fitWidth(table: HTMLTableElement, widths: number[], index: number) {
  const measuring = [...widths];
  measuring[index] = MIN_WIDTH;
  applyWidths(table, measuring, false);
  const header = headerCells(table)[index];
  const headerWhiteSpace = header.style.whiteSpace;
  header.style.whiteSpace = 'nowrap';
  const columnCount = widths.length;
  const rows = [table.tHead?.rows[0], ...Array.from(table.tBodies).flatMap((body) => Array.from(body.rows))];
  let width = MIN_WIDTH;
  rows.forEach((row) => {
    if (!row || row.cells.length !== columnCount) return;
    width = Math.max(width, row.cells[index].scrollWidth + 2);
  });
  header.style.whiteSpace = headerWhiteSpace;
  return Math.min(MAX_WIDTH, width);
}

function finishResize(table: HTMLTableElement, widths: number[]) {
  columnWidths.set(table, widths);
  applyWidths(table, widths);
  saveWidths(table.dataset.columnResizeKey || tableKey(table), widths);
}

function createHandle(table: HTMLTableElement, header: HTMLTableCellElement) {
  const handle = document.createElement('span');
  handle.dataset.columnResizeHandle = '';
  handle.setAttribute('aria-label', `Ubah lebar kolom ${headerLabel(header)}`);
  handle.title = 'Tarik untuk mengatur lebar kolom, klik dua kali untuk menyesuaikan isi';
  handle.textContent = '|';

  // Header cells may be sortable: keep handle clicks away from them.
  handle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  handle.addEventListener('dblclick', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const headers = headerCells(table);
    const index = headers.indexOf(header);
    if (index < 0) return;
    const widths = startingWidths(table, headers);
    widths[index] = fitWidth(table, widths, index);
    finishResize(table, widths);
  });
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const headers = headerCells(table);
    const index = headers.indexOf(header);
    if (index < 0) return;
    const widths = startingWidths(table, headers);
    const startX = event.clientX;
    const startWidth = widths[index];
    // Never snap a column that is already outside the min/max range.
    const minWidth = Math.min(MIN_WIDTH, startWidth);
    const maxWidth = Math.max(MAX_WIDTH, startWidth);
    let moved = false;

    handle.setPointerCapture(event.pointerId);
    handle.dataset.active = '';
    document.body.dataset.columnResizing = '';

    const onMove = (moveEvent: PointerEvent) => {
      const width = Math.round(Math.max(minWidth, Math.min(maxWidth, startWidth + moveEvent.clientX - startX)));
      if (width === widths[index] && moved) return;
      widths[index] = width;
      moved = true;
      applyWidths(table, widths);
    };
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      handle.removeEventListener('lostpointercapture', onEnd);
      delete handle.dataset.active;
      delete document.body.dataset.columnResizing;
      if (moved) finishResize(table, widths);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
    handle.addEventListener('lostpointercapture', onEnd);
  });
  return handle;
}

function initializeTable(table: HTMLTableElement, containers: ResizeObserver) {
  // Nested tables (for example the Kartu Stok ledger) are detail content, not primary grids.
  if (table.parentElement?.closest('td')) return;
  const headers = headerCells(table);
  if (!headers.length) return;
  if (table.dataset.columnResizeTable === undefined) {
    table.dataset.columnResizeTable = '';
    if (table.parentElement) containers.observe(table.parentElement);
  }

  // Restore saved widths when the table appears, its columns change, or React re-creates header cells.
  const key = tableKey(table);
  if (table.dataset.columnResizeKey !== key) {
    table.dataset.columnResizeKey = key;
    const saved = readWidths(key);
    if (saved?.length === headers.length) {
      columnWidths.set(table, saved);
      applyWidths(table, saved);
    } else if (table.dataset.columnResizeSized !== undefined) {
      clearWidths(table);
    }
  } else {
    const current = columnWidths.get(table);
    if (current?.length === headers.length && headers.some((header) => !header.style.width)) applyWidths(table, current);
  }

  headers.forEach((header) => {
    if (header.querySelector(':scope > [data-column-resize-handle]') || isUtilityColumn(header)) return;
    if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
    header.appendChild(createHandle(table, header));
  });
}

/** Shows the full value of a truncated cell on hover, recomputed each time so it never goes stale. */
function updateCellTitle(event: PointerEvent) {
  const cell = event.target instanceof Element ? event.target.closest('td') : null;
  const table = cell?.parentElement?.parentElement?.parentElement;
  if (!cell || !(table instanceof HTMLTableElement) || table.dataset.columnResizeTable === undefined) return;
  // Keep tooltips the page set itself, and leave cells with controls alone.
  if (cell.title && cell.dataset.columnResizeTitle === undefined) return;
  if (cell.querySelector('button, input, select, textarea')) return;
  const fullValue = cell.textContent?.replace(/\s+/g, ' ').trim();
  if (fullValue && cell.scrollWidth > cell.clientWidth) {
    cell.title = fullValue;
    cell.dataset.columnResizeTitle = '';
  } else if (cell.dataset.columnResizeTitle !== undefined) {
    cell.removeAttribute('title');
    delete cell.dataset.columnResizeTitle;
  }
}

export default function TableColumnResizer() {
  useEffect(() => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = RESIZER_CSS;
      document.head.appendChild(style);
    }

    // Keep the filler column in step with its container (window resize, sidebar toggles).
    const containers = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.querySelectorAll<HTMLTableElement>(`:scope > ${TABLE_SELECTOR}`).forEach((table) => {
          const widths = columnWidths.get(table);
          if (widths) applyWidths(table, widths);
        });
      });
    });

    let frame = 0;
    const scan = () => {
      frame = 0;
      document.querySelectorAll<HTMLTableElement>('table').forEach((table) => initializeTable(table, containers));
    };
    const scheduleScan = () => {
      if (!frame) frame = requestAnimationFrame(scan);
    };
    scan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('pointerover', updateCellTitle);
    return () => {
      observer.disconnect();
      containers.disconnect();
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('pointerover', updateCellTitle);
    };
  }, []);

  return null;
}
