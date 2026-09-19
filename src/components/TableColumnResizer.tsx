'use client';

import { useEffect } from 'react';

const STORAGE_PREFIX = 'erp-table-widths:';

function tableKey(table: HTMLTableElement) {
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
    .map((header) => header.textContent?.replace(/\s+/g, ' ').trim() || '')
    .join('|');
  return `${STORAGE_PREFIX}${headers}`;
}

function readWidths(table: HTMLTableElement) {
  try {
    const widths = JSON.parse(window.localStorage.getItem(tableKey(table)) || '[]');
    return Array.isArray(widths) && widths.every((width) => typeof width === 'number') ? widths : null;
  } catch {
    return null;
  }
}

function applyWidths(table: HTMLTableElement, widths: number[]) {
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
  if (headers.length !== widths.length) return;
  const totalWidth = widths.reduce((total, width) => total + width, 0);
  table.style.tableLayout = 'fixed';
  table.style.width = `${totalWidth}px`;
  table.style.minWidth = `${totalWidth}px`;
  headers.forEach((header, index) => {
    header.style.width = `${widths[index]}px`;
    header.style.minWidth = `${widths[index]}px`;
    header.style.maxWidth = `${widths[index]}px`;
  });
  if (table.parentElement) table.parentElement.style.overflowX = 'auto';
}

function standardizeDataCells(table: HTMLTableElement) {
  table.querySelectorAll<HTMLTableCellElement>('tbody td').forEach((cell) => {
    cell.style.whiteSpace = 'nowrap';
    cell.style.overflow = 'hidden';
    cell.style.textOverflow = 'ellipsis';
    // Preserve controls (buttons, inputs, selects) without replacing their own tooltips.
    if (!cell.title && !cell.querySelector('button, input, select, textarea')) {
      const fullValue = cell.textContent?.replace(/\s+/g, ' ').trim();
      if (fullValue) cell.title = fullValue;
    }
  });
}

function initializeTable(table: HTMLTableElement) {
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
  if (!headers.length) return;
  standardizeDataCells(table);

  const savedWidths = readWidths(table);
  if (savedWidths?.length === headers.length && table.dataset.columnResizeWidthsApplied !== 'true') {
    applyWidths(table, savedWidths);
    table.dataset.columnResizeWidthsApplied = 'true';
  }

  headers.forEach((header, index) => {
    // Keep the leading utility/index column (row number, expand button, checkbox) fixed.
    if (index === 0) return;
    if (header.querySelector(':scope > [data-erp-column-resize-handle]')) return;
    header.style.position = 'relative';
    const handle = document.createElement('span');
    handle.dataset.erpColumnResizeHandle = 'true';
    handle.setAttribute('aria-label', `Ubah lebar kolom ${header.textContent?.trim() || index + 1}`);
    handle.title = 'Tarik untuk mengatur lebar kolom';
    handle.textContent = '|';
    handle.style.cssText = 'position:absolute;right:-4px;top:0;width:8px;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px;font-weight:700;line-height:1;cursor:col-resize;z-index:30;touch-action:none;transition:color .15s;';
    handle.addEventListener('pointerenter', () => {
      handle.style.color = '#92400e';
    });
    handle.addEventListener('pointerleave', () => {
      handle.style.color = '#64748b';
    });
    // Header cells may be sortable. A completed drag emits a click after pointerup,
    // so stop that click here as well as the initial pointer event.
    handle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const currentHeaders = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
      const widths = currentHeaders.map((currentHeader) => Math.max(80, Math.round(currentHeader.getBoundingClientRect().width)));
      const startX = event.clientX;
      const startWidth = widths[index];
      const onMove = (moveEvent: PointerEvent) => {
        widths[index] = Math.max(80, Math.min(700, startWidth + moveEvent.clientX - startX));
        applyWidths(table, widths);
      };
      const onUp = () => {
        window.localStorage.setItem(tableKey(table), JSON.stringify(widths));
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    });
    header.appendChild(handle);
  });
}

export default function TableColumnResizer() {
  useEffect(() => {
    const scan = () => document.querySelectorAll<HTMLTableElement>('table').forEach(initializeTable);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
