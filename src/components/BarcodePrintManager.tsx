'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Printer, Trash2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Zap, ArrowLeft } from 'lucide-react';
import { ERPProduct } from '@/types/erp';
import { useDebounce } from '@/hooks/useDebounce';
import { searchInventory, lookupInventoryByScan } from '@/lib/inventory-lookup';
import { encodeBarcode } from '@/lib/barcode';
import {
  LegacyWindow, LegacyButton, GroupBox, FieldRow, LegacyInput, LegacyGrid, ContextMenu, menuAt, lx, fmtN0,
  type LegacyColumn, type ContextMenuState,
} from '@/components/legacy';

/** Real scannable bars for a stored barcode value, drawn as SVG (one unit = one module). */
export function BarcodeBars({ value, height }: { value: string; height: string }) {
  const encoded = encodeBarcode(value);
  if (!encoded) return <div style={{ height }} />;
  // Blank quiet zone each side (11 modules EAN, 10 Code 128) so scanners find the start/stop patterns
  const quiet = encoded.quietZone;
  const total = encoded.modules.length + quiet * 2;
  return (
    <svg
      data-testid="barcode-svg"
      data-symbology={encoded.symbology}
      viewBox={`0 0 ${total} 10`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      style={{ width: '100%', height, display: 'block' }}
    >
      <rect x={0} y={0} width={total} height={10} fill="#fff" />
      {Array.from(encoded.modules).map((m, i) =>
        m === '1' ? <rect key={i} x={quiet + i} y={0} width={1} height={10} fill="#000" /> : null,
      )}
    </svg>
  );
}

/** One row of the saved print list (GET /api/barcode-list, table m_invprintbarcode). */
interface BarcodeQueueItem {
  inventoryId: number;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  price: number;
  qty: number;
}

type LabelItem = Pick<BarcodeQueueItem, 'barcode' | 'inventoryNo' | 'inventoryName' | 'price'>;

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface BarcodePrintManagerProps {
  isDark: boolean;
  onBack?: () => void;
}

// "Print A4" = old Rpt_PrintOpname: A4, margins 10.85 / 11.1 / 9.2 / 10.6 mm (top/right/bottom/left), 3 columns
// across then down, 24.08 mm rows: Code 128 bars 58.2 x 12.96 mm with the value under them, then the name (Lato 10).
// Pages are cut by hand (11 rows x 3 fit the 276.95 mm between the margins) so every page has the same grid.
const A4_LABELS_PER_PAGE = 33;
const A4_PRINT_CSS = `
  @media print {
    @page { size: A4; margin: 0; }
    body { display: block !important; background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
    body > :not(#print-label-area) { display: none !important; }
    #print-label-area { display: block !important; margin: 0 !important; padding: 0 !important; }
  }
`;

/** Old Rpt_PrintOpname sheet: one cell per label (qty copies of each list row). */
function A4LabelSheet({ labels }: { labels: LabelItem[] }) {
  const pages: LabelItem[][] = [];
  for (let i = 0; i < labels.length; i += A4_LABELS_PER_PAGE) pages.push(labels.slice(i, i + A4_LABELS_PER_PAGE));
  return (
    <>
      {pages.map((page, pageIdx) => (
        <div
          key={pageIdx}
          className="a4-page bg-white text-black"
          style={{
            width: '210mm', height: '296mm', boxSizing: 'border-box', padding: '10.85mm 11.1mm 9.2mm 10.6mm',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '24.08mm', alignContent: 'start',
            overflow: 'hidden', breakAfter: pageIdx < pages.length - 1 ? 'page' : 'auto',
          }}
        >
          {page.map((label, idx) => {
            const value = label.barcode || label.inventoryNo;
            return (
              <div key={idx} className="a4-label" style={{ paddingLeft: '2.42mm', overflow: 'hidden' }}>
                <div style={{ width: '58.2mm', height: '12.96mm', padding: '0 2.6mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <BarcodeBars value={value} height="8.8mm" />
                  <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt', lineHeight: 1.2 }}>{value}</div>
                </div>
                <div style={{ width: '58.2mm', height: '6.35mm', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: 'Lato, Arial, sans-serif', fontSize: '10pt', lineHeight: 1.1, textAlign: 'center' }}>
                  {label.inventoryName}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

const STORE_NAME = 'HARMONY KITCHEN';
const noopSubscribe = () => () => {};
const LABEL_SIZE = '108x18-3col';

/** Old ".: Barcode Print List :." panel of Master_Data.Frm_InvList: list Barcode | Inventory No | Qty and the print buttons. */
export default function BarcodePrintManager({ isDark, onBack }: BarcodePrintManagerProps) {
  const c = lx(isDark);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Labels to print: the saved list, shared by every user like the old app
  const [queue, setQueue] = useState<BarcodeQueueItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  // Qty last saved per item, so leaving an unchanged Qty cell does not write
  const savedQtyRef = useRef<Map<number, number>>(new Map());
  const [rowMenu, setRowMenu] = useState<ContextMenuState<BarcodeQueueItem> | null>(null);

  // Set by the clicked print button right before window.print()
  const [includePrice, setIncludePrice] = useState<boolean>(true);
  const [printLayout, setPrintLayout] = useState<'roll' | 'a4'>('roll');
  const [includeStoreName, setIncludeStoreName] = useState<boolean>(true);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // true only in the browser: the print area is portaled into <body>, which the server render does not have
  const canPortal = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Search products (request-id guard drops out-of-order responses); an empty query just hides the results
  const searchReqIdRef = useRef(0);
  useEffect(() => {
    const reqId = ++searchReqIdRef.current;
    if (!debouncedSearch.trim()) return;
    async function search() {
      setIsSearching(true);
      const { items, error } = await searchInventory(debouncedSearch, 20);
      if (reqId !== searchReqIdRef.current) return;
      setSearchResults(items);
      setIsSearching(false);
      if (error) addToast(error, 'error');
    }
    search();
  }, [debouncedSearch, addToast]);
  const visibleResults = searchQuery.trim() && debouncedSearch.trim() ? searchResults : [];

  // Clearing the box drops the in-flight search, its results and the spinner (the effect skips empty queries)
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      searchReqIdRef.current++;
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  // Reload the saved list; a request-id guard keeps an older response from overwriting a newer one
  const listReqIdRef = useRef(0);
  const loadList = useCallback(async () => {
    const reqId = ++listReqIdRef.current;
    try {
      const json = await fetch('/api/barcode-list').then((r) => r.json());
      if (reqId !== listReqIdRef.current) return;
      if (!json.success) throw new Error(json.error?.message || 'Gagal memuat list barcode');
      const rows: BarcodeQueueItem[] = json.data;
      savedQtyRef.current = new Map(rows.map((r) => [r.inventoryId, r.qty]));
      setQueue(rows);
    } catch (e: unknown) {
      if (reqId === listReqIdRef.current) addToast(e instanceof Error ? e.message : 'Gagal memuat list barcode', 'error');
    } finally {
      if (reqId === listReqIdRef.current) setIsLoadingList(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleAddToQueue = async (product: ERPProduct, qty = 1) => {
    try {
      const json = await fetch('/api/barcode-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId: Number(product.id), qty }),
      }).then((r) => r.json());
      if (!json.success) throw new Error(json.error?.message || json.error || 'Perintah Masukan Gagal');
      addToast(`"${product.inventoryName}" ditambahkan ke list barcode (${qty} pcs)`, 'info');
    } catch (e: unknown) {
      addToast(`Perintah Masukan Gagal: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
    await loadList();
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = searchQuery.trim();
      if (!raw) return;
      // Look up the current input directly: scanners press Enter before the debounced search returns
      // Clear right away so a fast follow-up scan types into an empty input instead of appending
      searchReqIdRef.current++;
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(true);
      const { item, error } = await lookupInventoryByScan(raw);
      setIsSearching(false);
      if (error) {
        addToast(error, 'error');
      } else if (item) {
        await handleAddToQueue(item, 1);
      } else {
        addToast(`Barang tidak ditemukan: ${raw}`, 'warning');
      }
    } else if (e.key === 'Escape') {
      setSearchResults([]);
    }
  };

  // Typing changes the labels at once; the qty is saved when the cell is left (old GV_Barcode_ValidateRow)
  const handleUpdateQty = (inventoryId: number, newQty: number) => {
    const clampedQty = Math.max(1, Math.min(999, isNaN(newQty) ? 1 : newQty));
    setQueue((prev) => prev.map((item) => (item.inventoryId === inventoryId ? { ...item, qty: clampedQty } : item)));
  };

  const handleSaveQty = async (item: BarcodeQueueItem) => {
    if (savedQtyRef.current.get(item.inventoryId) === item.qty) return;
    try {
      const json = await fetch('/api/barcode-list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId: item.inventoryId, qty: item.qty }),
      }).then((r) => r.json());
      if (!json.success) throw new Error(json.error?.message || 'Gagal menyimpan qty');
      savedQtyRef.current.set(item.inventoryId, item.qty);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Gagal menyimpan qty', 'error');
      await loadList();
    }
  };

  // Old "Delete Row" (sp_MDInventory_PrintBarcodeDelList) and "Hapus Data List Barcode" (sp_MDInventory_PrintBarcodeDelAll)
  const deleteFromList = async (query: string, successText: string) => {
    try {
      const json = await fetch(`/api/barcode-list?${query}`, { method: 'DELETE' }).then((r) => r.json());
      if (!json.success) throw new Error(json.error?.message || 'Perintah Hapus Gagal');
      addToast(`Perintah Hapus Berhasil: ${successText}`, 'success');
    } catch (e: unknown) {
      addToast(`Perintah Hapus Gagal: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
    await loadList();
  };

  const handleRemoveFromQueue = (item: BarcodeQueueItem) =>
    deleteFromList(`inventoryId=${item.inventoryId}`, `${item.inventoryName} DIHAPUS`);

  const handleDeleteAll = () => deleteFromList('all=1', 'Menghapus Semua Daftar Antrian Cetak Barcode');

  const totalLabels = queue.reduce((sum, item) => sum + item.qty, 0);

  // The two roll buttons print the same labels ("w/o Price" hides the price line); "Print A4" is the old
  // Rpt_PrintOpname sheet of the same list
  const handlePrint = async (withPrice: boolean, layout: 'roll' | 'a4' = 'roll') => {
    if (queue.length === 0) {
      addToast('List barcode kosong. Tambahkan barang terlebih dahulu.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/barcode/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: queue.map((item) => ({
            product: { id: String(item.inventoryId), barcode: item.barcode, inventoryName: item.inventoryName },
            printQty: item.qty,
          })),
          totalLabels,
          labelSize: layout === 'a4' ? 'A4-3col' : LABEL_SIZE,
          includePrice: withPrice,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast(json.error?.message || json.error || 'Izin cetak barcode ditolak.', 'error');
        return;
      }
    } catch (e: unknown) {
      console.error('Error logging barcode print audit:', e);
    }

    // Render the print area with the chosen layout / price setting before the print dialog snapshots it
    flushSync(() => {
      setIncludePrice(withPrice);
      setPrintLayout(layout);
    });
    window.print();
  };

  // One label per qty, in list order (old sp_MDInventory_PrintBarcodeListLabel)
  const flattenedLabels: LabelItem[] = [];
  queue.forEach((item) => {
    for (let i = 0; i < item.qty; i++) {
      flattenedLabels.push(item);
    }
  });

  // Group flattened labels into 3-column rows (AcrossThenDown: Col 1 -> Col 2 -> Col 3)
  // Matches legacy Rpt_LabelBarcodePrice (PageWidth=1080 [108mm], ColumnCount=3, ColumnWidth=360 [36mm], Height=182 [18.2mm])
  const labelRows: (LabelItem | null)[][] = [];
  for (let i = 0; i < flattenedLabels.length; i += 3) {
    labelRows.push([
      flattenedLabels[i] || null,
      flattenedLabels[i + 1] || null,
      flattenedLabels[i + 2] || null,
    ]);
  }

  const columns: LegacyColumn<BarcodeQueueItem>[] = [
    { key: 'barcode', caption: 'Barcode' },
    {
      // The old SP aliased the item name as "InventoryNo", so this column showed names; the No. Barang is the tooltip
      key: 'inventoryNo', caption: 'Inventory No',
      render: (item) => <span title={item.inventoryNo}>{item.inventoryName}</span>,
    },
    {
      key: 'qty', caption: 'Qty', align: 'right', width: 80,
      render: (item) => (
        <input
          type="number"
          min={1}
          max={999}
          aria-label="Qty"
          value={item.qty}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) handleUpdateQty(item.inventoryId, val);
          }}
          onBlur={() => handleSaveQty(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className={`w-16 px-1 py-0.5 rounded border text-right tabular-nums outline-none focus:ring-1 focus:ring-blue-500 ${c.input}`}
        />
      ),
    },
  ];

  const closeRowMenu = useCallback(() => setRowMenu(null), []);

  return (
    <LegacyWindow
      title="Cetak Barcode"
      isDark={isDark}
      toolbar={
        <>
          {onBack && (
            <LegacyButton isDark={isDark} icon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={onBack} className="print:hidden">Back</LegacyButton>
          )}
          <div className="relative w-full max-w-md print:hidden">
            <FieldRow label="Cari Barang :" isDark={isDark} labelWidth="w-auto">
              <LegacyInput
                ref={searchInputRef}
                isDark={isDark}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan barcode / ketik No. Barang / Nama..."
              />
              {isSearching && <RefreshCw className="w-3.5 h-3.5 shrink-0 text-blue-500 animate-spin" />}
            </FieldRow>

            {/* Search results: click to add to the list */}
            {visibleResults.length > 0 ? (
              <div className={`absolute left-0 right-0 top-full mt-1 z-40 max-h-64 overflow-y-auto rounded border shadow-xl divide-y ${c.panel} ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {visibleResults.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      handleAddToQueue(p, 1);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className={`w-full px-2 py-1.5 flex items-center justify-between gap-2 text-left cursor-pointer ${c.rowHover}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{p.inventoryName}</span>
                      <span className={`block font-mono text-[10px] ${c.muted}`}>{p.inventoryNo} | {p.barcode}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">Rp {fmtN0(p.price || 0)}</span>
                  </button>
                ))}
              </div>
            ) : (
              debouncedSearch.trim() && searchQuery.trim() && !isSearching && (
                <div className={`absolute left-0 right-0 top-full mt-1 z-40 px-2 py-2 rounded border shadow ${c.panel} ${c.muted}`}>
                  Barang tidak ditemukan untuk kata kunci &ldquo;{debouncedSearch}&rdquo;.
                </div>
              )
            )}
          </div>
        </>
      }
    >
      {/* 🔔 FLOATING TOASTS */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none print:hidden">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 fade-in duration-200 ${
              toast.type === 'success'
                ? isDark ? 'bg-emerald-950/90 border-emerald-800 text-emerald-300' : 'bg-emerald-800 text-white border-emerald-900'
                : toast.type === 'error'
                ? isDark ? 'bg-rose-950/90 border-rose-800 text-rose-300' : 'bg-rose-800 text-white border-rose-900'
                : toast.type === 'warning'
                ? isDark ? 'bg-amber-950/90 border-amber-800 text-amber-300' : 'bg-amber-800 text-white border-amber-900'
                : isDark ? 'bg-indigo-950/90 border-indigo-800 text-indigo-300' : 'bg-indigo-800 text-white border-indigo-900'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />}
            {toast.type === 'info' && <Zap className="w-4 h-4 text-indigo-300 shrink-0" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      {/* 🖨️ PRINT CSS: 3-column thermal roll (108mm = 3 x 36mm, 18.2mm rows) or the A4 sheet of "Print A4" */}
      <style>{printLayout === 'a4' ? A4_PRINT_CSS : `
        @media print {
          @page {
            size: 108mm 18.2mm;
            margin: 0;
          }
          body {
            display: block !important;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* The label area is a direct child of <body>; the app layout around it would offset / clip it */
          body > :not(#print-label-area) {
            display: none !important;
          }
          #print-label-area {
            display: block !important;
            width: 108mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .barcode-label-row {
            width: 108mm !important;
            height: 18.2mm !important;
            max-height: 18.2mm !important;
            page-break-after: always !important;
            box-sizing: border-box !important;
            display: grid !important;
            grid-template-columns: repeat(3, 36mm) !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .barcode-label-cell {
            width: 36mm !important;
            height: 18.2mm !important;
            max-height: 18.2mm !important;
            box-sizing: border-box !important;
            padding: 1mm 1.5mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            text-align: center !important;
            font-family: monospace, sans-serif !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      <GroupBox caption=".: Barcode Print List :." isDark={isDark} className="flex-1 w-full max-w-4xl print:hidden">
        <div className="flex-1 min-h-[240px] flex flex-col">
          <LegacyGrid
            isDark={isDark}
            columns={columns}
            rows={queue}
            rowKey={(item) => item.inventoryId}
            loading={isLoadingList}
            emptyText="List barcode kosong. Scan atau cari barang untuk menambahkan."
            onRowContextMenu={(item, e) => setRowMenu(menuAt(e, item, 1))}
          />
        </div>
        <LegacyButton isDark={isDark} icon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleDeleteAll} disabled={queue.length === 0} className="justify-center">
          Hapus Data List Barcode
        </LegacyButton>
        <LegacyButton isDark={isDark} icon={<Printer className="w-3.5 h-3.5" />} onClick={() => handlePrint(false, 'a4')} disabled={queue.length === 0} className="justify-center">
          Print A4
        </LegacyButton>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <LegacyButton isDark={isDark} icon={<Printer className="w-3.5 h-3.5" />} onClick={() => handlePrint(false)} disabled={queue.length === 0} className="justify-center">
            Barcode Print w/o Price
          </LegacyButton>
          <LegacyButton isDark={isDark} icon={<Printer className="w-3.5 h-3.5" />} onClick={() => handlePrint(true)} disabled={queue.length === 0} className="justify-center">
            Barcode Print With Price
          </LegacyButton>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={includeStoreName} onChange={(e) => setIncludeStoreName(e.target.checked)} />
          <span>Header Toko</span>
        </label>
      </GroupBox>

      {rowMenu && (
        <ContextMenu
          isDark={isDark}
          x={rowMenu.x}
          y={rowMenu.y}
          onClose={closeRowMenu}
          items={[
            { label: 'Delete Row', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => handleRemoveFromQueue(rowMenu.row) },
          ]}
        />
      )}

      {/* 🖨️ HIDDEN PRINT TARGET CONTAINER (Visible only in print media: 3 columns per row on 108mm roll) */}
      {canPortal && createPortal(
        <div id="print-label-area" className="hidden print:block">
          {printLayout === 'a4' ? <A4LabelSheet labels={flattenedLabels} /> : labelRows.map((rowSlots, rowIdx) => (
            <div key={rowIdx} className="barcode-label-row bg-white text-black">
              {rowSlots.map((prod, colIdx) => (
                <div key={colIdx} className="barcode-label-cell bg-white text-black">
                  {prod ? (
                    <>
                      {includeStoreName && (
                        <div style={{ fontSize: '5.5pt', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1 }}>
                          {STORE_NAME}
                        </div>
                      )}
  
                      {/* One line: a second line does not fit the 18.2mm label and was cut through the middle */}
                      <div style={{ fontSize: '6.5pt', fontWeight: 'bold', lineHeight: '1.05', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%' }}>
                        {prod.inventoryNo} - {prod.inventoryName}
                      </div>
  
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0.5mm 0' }}>
                        <div style={{ width: '96%' }}>
                          <BarcodeBars value={prod.barcode || prod.inventoryNo} height="5.5mm" />
                        </div>
                        <div style={{ fontSize: '6pt', fontWeight: 'bold', letterSpacing: '0.5px', lineHeight: 1 }}>
                          {prod.barcode || prod.inventoryNo}
                        </div>
                      </div>
  
                      {includePrice && (
                        <div style={{ fontSize: '7pt', fontWeight: 'bold', lineHeight: 1 }}>
                          Rp {(prod.price || 0).toLocaleString('id-ID')}
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </LegacyWindow>
  );
}
