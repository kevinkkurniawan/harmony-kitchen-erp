'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  Search,
  History,
  Store,
  Barcode as BarcodeIcon,
  Trash2,
  Layers,
  Sparkles,
  Minus,
  AlertTriangle,
  Check,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Package,
  Printer,
  Download,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export interface OpnameEntry {
  id?: number;
  inventoryId: number;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  qty: number;
  price: number;
  description: string;
}

export interface OpnameHistoryHeader {
  id: number | string;
  noTransaction: string;
  opnameNo?: string;
  opname_no?: string;
  opnameDate: string;
  status?: string;
  warehouse: string;
  whName?: string;
  wh_name?: string;
  totalItems: number;
  totalQty: number;
  remarks: string;
  createdBy: string;
}

export interface InventoryLookupItem {
  id: number;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  price: number;
  uomName?: string;
  brandName?: string;
  categoryName?: string;
  stokUpdate?: number;
  stokAkhir?: number;
  stock?: number;
  totalValue?: number;
}

interface Warehouse {
  id: number;
  whCode: number;
  location: string;
}

interface StockOpnameManagerProps {
  isDark: boolean;
}

export default function StockOpnameManager({ isDark }: StockOpnameManagerProps) {
  // Master & Lookup States
  const [inventoryList, setInventoryList] = useState<InventoryLookupItem[]>([]);
  const [historyList, setHistoryList] = useState<OpnameHistoryHeader[]>([]);
  const [selectedHistoryTx, setSelectedHistoryTx] = useState<string>('');

  // Form States
  const [noTransaction, setNoTransaction] = useState<string>('');
  const [warehouse, setWarehouse] = useState<string>('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [opnameItems, setOpnameItems] = useState<OpnameEntry[]>([]);

  // Input Form Fields
  const [selectedInvId, setSelectedInvId] = useState<number | ''>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [qtyInput, setQtyInput] = useState<number | ''>(1);
  const [descInput, setDescInput] = useState<string>('');

  // Table Filter & Search States
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortField('');
      setSortOrder('asc');
    }
  };

  // Status States
  const [opnameStatus, setOpnameStatus] = useState<'NEW' | 'DRAFT' | 'POSTED' | 'REVERSED'>('NEW');
  const [reversedReasonText, setReversedReasonText] = useState<string>('');
  const [isReverseModalOpen, setIsReverseModalOpen] = useState<boolean>(false);
  const [reverseReasonInput, setReverseReasonInput] = useState<string>('');
  const [auditorName, setAuditorName] = useState<string>('Super Administrator');
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const loadSeqRef = useRef<number>(0);

  const isReadOnly = opnameStatus === 'POSTED' || opnameStatus === 'REVERSED';

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const extractErrorMessage = (err: unknown, fallback: string): string => {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
      const maybeMsg = (err as { message?: unknown }).message;
      if (typeof maybeMsg === 'string' && maybeMsg.trim()) return maybeMsg;
    }
    return fallback;
  };

  // Generate New Transaction No
  const generateNewTxNo = useCallback(() => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `OPN/${yyyy}/${mm}/${rnd}`;
  }, []);

  // Fetch Warehouses Lookup
  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/lookups');
      const json = await res.json();
      if (json.success && json.data.warehouses) {
        setWarehouses(json.data.warehouses);
        if (json.data.warehouses.length > 0) {
          setWarehouse((prev) => prev || json.data.warehouses[0].location);
        }
      }
    } catch (e) {
      console.error('Failed to fetch warehouses', e);
    }
  }, []);

  // Refresh Inventory & History Lookups without clobbering current form state
  const refreshLookupsAndHistory = useCallback(async () => {
    const [invRes, histRes] = await Promise.all([
      fetch('/api/inventory?limit=500'),
      fetch('/api/inventory/opname'),
    ]);
    const invJson = await invRes.json();
    const rawItems: InventoryLookupItem[] = invJson.data?.items || invJson.data || [];
    const itemsArray: InventoryLookupItem[] = Array.isArray(rawItems)
      ? rawItems.map((it) => ({ ...it, id: Number(it.id) }))
      : [];
    if (invJson.success && Array.isArray(itemsArray)) {
      setInventoryList(itemsArray);
    }

    const histJson = await histRes.json();
    const histArray = histJson.data?.items || histJson.data || [];
    if (histJson.success && Array.isArray(histArray)) {
      setHistoryList(histArray);
    }
    return itemsArray;
  }, []);

  // Fetch Inventory Lookups & Opname History on initial mount
  const loadInitialData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setIsLoading(true);
    try {
      await fetchWarehouses();
      const itemsArray = await refreshLookupsAndHistory();

      if (seq !== loadSeqRef.current) return;

      if (Array.isArray(itemsArray) && itemsArray.length > 0) {
        const allItems: OpnameEntry[] = itemsArray.map((item: InventoryLookupItem) => {
          const itemQty = item.stokAkhir !== undefined ? Number(item.stokAkhir) : Number(item.stock || 0);
          return {
            inventoryId: Number(item.id),
            inventoryNo: item.inventoryNo,
            barcode: item.barcode || item.inventoryNo,
            inventoryName: item.inventoryName,
            qty: itemQty,
            price: Number(item.price || 0),
            description: 'Stok Opname Catalog',
          };
        });
        setOpnameItems(allItems);
      }

      setNoTransaction(generateNewTxNo());
      setSelectedHistoryTx('');
      setOpnameStatus('NEW');
      setReversedReasonText('');
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      console.error('Failed to load opname data:', err);
      showToast('Gagal memuat data master opname', 'error');
    } finally {
      if (seq === loadSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [generateNewTxNo, fetchWarehouses, refreshLookupsAndHistory]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle New Opname Button
  const handleNewOpname = () => {
    ++loadSeqRef.current;
    setIsLoading(false);
    setNoTransaction(generateNewTxNo());
    setSelectedHistoryTx('');
    setOpnameStatus('NEW');
    setReversedReasonText('');
    setOpnameItems([]);
    setSelectedInvId('');
    setBarcodeInput('');
    setQtyInput(1);
    setDescInput('');
    showToast('Form Stok Opname Baru Siap Diisi', 'info');
  };

  // Handle Populate All Products for Bulk Opname
  const handlePopulateAll = () => {
    if (inventoryList.length === 0) {
      showToast('Daftar barang inventori belum dimuat', 'info');
      return;
    }
    if (isReadOnly) {
      showToast('Transaksi yang sudah diposting/dibatalkan tidak dapat diubah. Klik "Baru" terlebih dahulu.', 'error');
      return;
    }
    const allItems: OpnameEntry[] = inventoryList.map((item) => {
      const itemQty = item.stokAkhir !== undefined ? Number(item.stokAkhir) : Number(item.stock || 0);
      return {
        inventoryId: Number(item.id),
        inventoryNo: item.inventoryNo,
        barcode: item.barcode || item.inventoryNo,
        inventoryName: item.inventoryName,
        qty: itemQty,
        price: Number(item.price || 0),
        description: 'Auto-Populate Opname Massal',
      };
    });
    setOpnameItems(allItems);
    showToast(`Semua ${allItems.length} barang berhasil dimuat ke tabel opname!`, 'success');
  };

  // Handle Barcode Auto-Fill
  const handleBarcodeChange = (val: string) => {
    setBarcodeInput(val);
    const found = inventoryList.find((item) => item.barcode === val || item.inventoryNo === val);
    if (found) {
      setSelectedInvId(Number(found.id));
    }
  };

  // Handle Inventory Selection Change
  const handleInventorySelect = (idNum: number) => {
    setSelectedInvId(idNum);
    const found = inventoryList.find((item) => Number(item.id) === Number(idNum));
    if (found) {
      setBarcodeInput(found.barcode || found.inventoryNo);
    }
  };

  // Add Item to Pending Opname List
  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (isReadOnly) {
      showToast('Transaksi ini bersifat baca-saja. Klik "Baru" untuk membuat opname baru.', 'error');
      return;
    }

    let found: InventoryLookupItem | undefined = selectedInvId
      ? inventoryList.find((i) => Number(i.id) === Number(selectedInvId))
      : undefined;

    // Fallback 1: If no item selected via dropdown, lookup in local list by scanned barcode or SKU
    const rawScan = barcodeInput.trim();
    if (!found && rawScan) {
      const q = rawScan.toLowerCase();
      found = inventoryList.find(
        (i) => (i.barcode && i.barcode.toLowerCase() === q) || (i.inventoryNo && i.inventoryNo.toLowerCase() === q)
      );
    }

    // Fallback 2: If item isn't in local list yet, query API directly by barcode/SKU
    if (!found && rawScan) {
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(rawScan)}&limit=20`);
        const json = await res.json();
        const remoteItems: InventoryLookupItem[] = json.data?.items || json.data || [];
        const q = rawScan.toLowerCase();
        const exactMatch = remoteItems.find(
          (i) => (i.barcode && i.barcode.toLowerCase() === q) || (i.inventoryNo && i.inventoryNo.toLowerCase() === q)
        ) || remoteItems[0];
        if (exactMatch) {
          found = { ...exactMatch, id: Number(exactMatch.id) };
          setInventoryList((prev) => (prev.some((p) => Number(p.id) === Number(found!.id)) ? prev : [found!, ...prev]));
        }
      } catch (err) {
        console.error('Fallback barcode lookup failed:', err);
      }
    }

    if (!found) {
      showToast('Pilih barang atau scan barcode yang valid terlebih dahulu!', 'error');
      return;
    }

    const qty = typeof qtyInput === 'number' ? qtyInput : 0;
    if (qty < 0) {
      showToast('Qty opname tidak boleh negatif', 'error');
      return;
    }

    const foundId = Number(found.id);
    const noteText = descInput;
    let wasExisting = false;

    setOpnameItems((prev) => {
      const existingIdx = prev.findIndex((i) => Number(i.inventoryId) === foundId);
      if (existingIdx >= 0) {
        wasExisting = true;
        const updated = [...prev];
        const [itemToMove] = updated.splice(existingIdx, 1);
        const updatedItem = {
          ...itemToMove,
          qty,
          description: noteText || 'Penyesuaian Opname',
        };
        updated.unshift(updatedItem);
        return updated;
      }
      return [
        {
          inventoryId: foundId,
          inventoryNo: found!.inventoryNo,
          barcode: found!.barcode || found!.inventoryNo,
          inventoryName: found!.inventoryName,
          qty,
          price: Number(found!.price || 0),
          description: noteText || 'Stok Opname',
        },
        ...prev,
      ];
    });

    if (wasExisting) {
      showToast(`Qty "${found.inventoryName}" diperbarui menjadi ${qty}`, 'info');
    } else {
      showToast(`"${found.inventoryName}" berhasil ditambahkan ke daftar`, 'success');
    }

    // Reset input fields
    setSelectedInvId('');
    setBarcodeInput('');
    setQtyInput(1);
    setDescInput('');

    // Auto-focus back to barcode scanner for rapid entry muscle memory
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Export Opname List to CSV
  const handleExportCSV = () => {
    if (opnameItems.length === 0) {
      showToast('Tidak ada item opname untuk diexport', 'error');
      return;
    }

    const headers = ['No', 'No. Barang / SKU', 'Barcode', 'Nama Barang', 'Qty', 'Harga Satuan', 'Total Nilai', 'Catatan'];
    const rows = opnameItems.map((item, idx) => {
      const totalItemValue = item.qty * (item.price || 0);
      return [
        idx + 1,
        `"${item.inventoryNo}"`,
        `"${item.barcode}"`,
        `"${item.inventoryName.replace(/"/g, '""')}"`,
        item.qty,
        item.price || 0,
        totalItemValue,
        `"${(item.description || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Opname_${(noTransaction || 'Draft').replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Laporan Opname berhasil diexport ke CSV', 'success');
  };

  // Print Opname Report
  const handlePrintReport = () => {
    if (opnameItems.length === 0) {
      showToast('Tidak ada item opname untuk dicetak', 'error');
      return;
    }
    window.print();
  };

  // Inline Qty Update Handler
  const handleInlineQtyChange = (invId: number, newQty: number) => {
    if (isReadOnly) return;
    const validQty = Math.max(0, newQty);
    setOpnameItems((prev) =>
      prev.map((item) => (item.inventoryId === invId ? { ...item, qty: validQty } : item))
    );
  };

  // Remove item from list
  const handleRemoveItem = (invId: number) => {
    if (isReadOnly) return;
    setOpnameItems((prev) => prev.filter((i) => i.inventoryId !== invId));
  };

  // Select History Transaction from Dropdown
  const handleSelectHistory = async (txNo: string) => {
    setSelectedHistoryTx(txNo);
    if (!txNo) {
      handleNewOpname();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/opname?noTx=${encodeURIComponent(txNo)}`);
      const json = await res.json();
      const payload = json.data;
      const detailItems = payload?.items || json.data?.items || json.data || [];
      if (json.success) {
        setNoTransaction(txNo);
        const statusVal = payload?.status || json.header?.status || 'POSTED';
        setOpnameStatus(statusVal);
        setReversedReasonText(payload?.reversedReason || '');
        if (payload?.warehouse || payload?.whName || json.header?.whName) {
          setWarehouse(payload?.warehouse || payload?.whName || json.header?.whName);
        }
        setOpnameItems(
          detailItems.map((d: any) => ({
            inventoryId: d.inventoryId || d.id,
            inventoryNo: d.inventoryNo || d.inventory_no,
            barcode: d.barcode,
            inventoryName: d.inventoryName || d.inventory_name,
            qty: d.qty !== undefined ? Number(d.qty) : Number(d.physical_qty ?? d.physicalQty ?? 0),
            price: Number(d.price || 0),
            description: d.description || d.notes || 'Stok Opname',
          }))
        );
        showToast(`Memuat Transaksi Opname ${txNo} (${statusVal})`, 'info');
      } else {
        showToast(extractErrorMessage(json.error, 'Gagal memuat detail transaksi opname'), 'error');
      }
    } catch (err) {
      console.error('Failed to load opname detail:', err);
      showToast('Gagal memuat detail transaksi opname', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Open Reconciliation Preview
  const handleOpenReconciliation = () => {
    if (opnameItems.length === 0) {
      showToast('Tidak ada item opname yang dimasukkan!', 'error');
      return;
    }
    if (isReadOnly) {
      showToast('Transaksi yang sudah diposting/dibatalkan tidak dapat disimpan ulang.', 'error');
      return;
    }
    setIsReconciling(true);
  };

  // Submit Opname Transaction (action: 'draft' | 'post')
  const handleSubmitOpname = async (action: 'draft' | 'post' = 'post') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const targetTxNo = noTransaction || generateNewTxNo();
    try {
      const res = await fetch('/api/inventory/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_tx: targetTxNo,
          noTransaction: targetTxNo,
          opnameNo: targetTxNo,
          wh_name: warehouse,
          warehouse,
          items: opnameItems.map((it) => ({
            inventoryId: it.inventoryId,
            barcode: it.barcode,
            qty: it.qty,
            price: it.price,
            description: it.description,
            notes: it.description,
          })),
          createdBy: auditorName,
          remarks: `Stok Opname ${targetTxNo} (Auditor: ${auditorName})`,
          notes: `Stok Opname ${targetTxNo} (Auditor: ${auditorName})`,
          action,
        }),
      });

      const json = await res.json();
      if (json.success) {
        const successMsg = json.message || (action === 'post' ? 'Stok Opname berhasil diposting!' : 'Draft Opname berhasil disimpan!');
        setIsReconciling(false);
        await refreshLookupsAndHistory();
        await handleSelectHistory(targetTxNo);
        showToast(successMsg, 'success');
      } else {
        showToast(extractErrorMessage(json.error, 'Gagal menyimpan stok opname'), 'error');
      }
    } catch (err) {
      console.error('Submit opname error:', err);
      showToast('Terjadi kesalahan saat menyimpan opname', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reverse Opname Handler
  const handleReverseOpname = async () => {
    if (!reverseReasonInput.trim()) {
      showToast('Alasan pembatalan (reversal) wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_tx: noTransaction,
          action: 'reverse',
          reason: reverseReasonInput,
        }),
      });

      const json = await res.json();
      if (json.success) {
        const successMsg = json.message || `Opname ${noTransaction} berhasil dibatalkan (reversed)!`;
        setIsReverseModalOpen(false);
        setReverseReasonInput('');
        await refreshLookupsAndHistory();
        await handleSelectHistory(noTransaction);
        showToast(successMsg, 'success');
      } else {
        showToast(extractErrorMessage(json.error, 'Gagal membatalkan opname'), 'error');
      }
    } catch (err) {
      console.error('Reverse opname error:', err);
      showToast('Terjadi kesalahan saat membatalkan opname', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Draft Management (Local Storage)
  const handleSaveDraft = () => {
    if (opnameItems.length === 0) {
      showToast('Tidak ada data untuk disimpan sebagai draft', 'error');
      return;
    }
    const draftData = {
      noTransaction,
      warehouse,
      auditorName,
      opnameItems,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('opname_draft', JSON.stringify(draftData));
    showToast('Draft stok opname berhasil disimpan ke browser', 'success');
  };

  const handleLoadDraft = () => {
    const draftStr = localStorage.getItem('opname_draft');
    if (!draftStr) {
      showToast('Tidak ada draft yang tersimpan', 'info');
      return;
    }
    try {
      const draft = JSON.parse(draftStr);
      setNoTransaction(draft.noTransaction);
      setWarehouse(draft.warehouse);
      setAuditorName(draft.auditorName || 'Super Administrator');
      setOpnameStatus('DRAFT');
      setSelectedHistoryTx('');
      setReversedReasonText('');
      setOpnameItems(
        (draft.opnameItems || []).map((it: any) => ({
          inventoryId: it.inventoryId,
          inventoryNo: it.inventoryNo,
          barcode: it.barcode,
          inventoryName: it.inventoryName,
          qty: Number(it.qty ?? 0),
          price: Number(it.price ?? 0),
          description: it.description || 'Draft Opname',
        }))
      );
      showToast(`Draft dimuat (Tersimpan pada: ${new Date(draft.savedAt).toLocaleString()})`, 'info');
    } catch (e) {
      showToast('Gagal memuat draft (Data corrupt)', 'error');
    }
  };

  // Statistics Calculations (Single Unified Qty)
  const stats = useMemo(() => {
    const totalItems = opnameItems.length;
    let totalQty = 0;
    let totalValue = 0;

    opnameItems.forEach((item) => {
      totalQty += item.qty;
      totalValue += item.qty * (item.price || 0);
    });

    return { totalItems, totalQty, totalValue };
  }, [opnameItems]);

  // Filtered and Sorted Table Items
  const filteredTableItems = useMemo(() => {
    let filtered = opnameItems.filter((item) => {
      const matchQuery =
        !tableSearch ||
        item.inventoryName.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.inventoryNo.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.barcode.toLowerCase().includes(tableSearch.toLowerCase());

      return matchQuery;
    });

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortField as keyof OpnameEntry];
        let bVal: any = b[sortField as keyof OpnameEntry];

        if (sortField === 'inventoryNo') {
          aVal = a.inventoryNo;
          bVal = b.inventoryNo;
        } else if (sortField === 'inventoryName') {
          aVal = a.inventoryName;
          bVal = b.inventoryName;
        } else if (sortField === 'qty') {
          aVal = a.qty;
          bVal = b.qty;
        } else if (sortField === 'description') {
          aVal = a.description;
          bVal = b.description;
        }

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = (bVal as string).toLowerCase();
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [opnameItems, tableSearch, sortField, sortOrder]);

  return (
    <div id="printable-opname-report" className="flex-1 flex flex-col h-full overflow-hidden select-none relative">
      {/* 🖨️ OPNAME PRINT MEDIA STYLESHEET */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print, nav, header, sidebar, button, select, input {
            display: none !important;
          }
          #printable-opname-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 20px !important;
            background: white !important;
            color: black !important;
            overflow: visible !important;
          }
          #printable-opname-report * {
            visibility: visible !important;
            color: black !important;
            border-color: #cbd5e1 !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 20px !important;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 12px !important;
          }
          .print-signatures {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 40px !important;
            padding-top: 20px !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #94a3b8 !important;
            padding: 6px 10px !important;
            font-size: 11px !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
        }
        .print-header, .print-signatures {
          display: none;
        }
      `}</style>

      {/* 🖨️ OFFICIAL PRINT HEADER (VISIBLE ONLY ON PRINT) */}
      <div className="print-header">
        <div className="flex justify-between items-center pb-2">
          <div>
            <h1 className="text-xl font-black uppercase text-black">HARMONY KITCHEN ERP</h1>
            <h2 className="text-sm font-bold text-slate-700">BERITA ACARA & LAPORAN STOK OPNAME GUDANG</h2>
          </div>
          <div className="text-right text-xs">
            <div><strong>No. Transaksi:</strong> {noTransaction}</div>
            <div><strong>Gudang:</strong> {warehouse}</div>
            <div><strong>Tanggal Opname:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
              : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle className={`w-5 h-5 shrink-0 ${isDark ? "text-white" : "text-slate-900"}`} />}
          {toastMessage.type === 'error' && <XCircle className={`w-5 h-5 shrink-0 ${isDark ? "text-white" : "text-slate-900"}`} />}
          {toastMessage.type === 'info' && <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 👑 TOP COMPACT WORKBENCH TOOLBAR */}
      <div
        className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shadow-sm shrink-0 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
        }`}
      >
        {/* Title & Transaction Selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-none">
                  Stok Opname
                </h1>
                <span
                  data-testid="opname-status-badge"
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    opnameStatus === 'POSTED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : opnameStatus === 'REVERSED'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : opnameStatus === 'DRAFT'
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {opnameStatus}
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-500 font-mono">
                {noTransaction || 'OPN/NEW'}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-800 hidden sm:block" />

          {/* Riwayat Dropdown */}
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <select
              value={selectedHistoryTx}
              onChange={(e) => handleSelectHistory(e.target.value)}
              className={`p-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer max-w-[240px] ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300'
              }`}
            >
              <option value="">-- Lihat Transaksi Opname --</option>
              {historyList.map((h) => {
                const txKey = h.noTransaction || h.opnameNo || h.opname_no || '';
                const whLabel = h.warehouse || h.whName || h.wh_name || 'Gudang Utama';
                const statusLabel = h.status ? ` [${h.status}]` : '';
                return (
                  <option key={h.id || txKey} value={txKey}>
                    {txKey} ({new Date(h.opnameDate).toLocaleDateString('id-ID')}) - {whLabel}{statusLabel}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Gudang Dropdown */}
          <div className="flex items-center gap-2">
            <Store className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className={`p-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300'
              }`}
            >
              <option value="" disabled>Pilih Gudang / Lokasi</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.location}>
                  {w.location}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-800 hidden sm:block" />

          {/* Session Setup Filters */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
              placeholder="Nama Auditor..."
              className={`w-36 p-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300'
              }`}
              title="Auditor Assignee"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleNewOpname}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Baru</span>
          </button>

          <button
            onClick={handlePopulateAll}
            disabled={isReadOnly}
            className={`px-3 py-1.5 rounded-xl border active:scale-95 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all ${
              isReadOnly
                ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 cursor-pointer'
            }`}
            title="Muat seluruh barang master inventori ke tabel opname"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Data ({inventoryList.length})</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={opnameItems.length === 0}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
              opnameItems.length === 0
                ? 'opacity-50 cursor-not-allowed border-slate-700 text-slate-500'
                : isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title="Export data opname ke CSV"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrintReport}
            disabled={opnameItems.length === 0}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
              opnameItems.length === 0
                ? 'opacity-50 cursor-not-allowed border-slate-700 text-slate-500'
                : isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title="Cetak Laporan Stok Opname"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Cetak</span>
          </button>

          <button
            onClick={loadInitialData}
            className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 active:scale-95 cursor-pointer transition-all ${
              isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={opnameItems.length === 0 || isReadOnly}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
              opnameItems.length === 0 || isReadOnly
                ? 'opacity-50 cursor-not-allowed border-slate-700 text-slate-500'
                : isDark ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200'
            }`}
            title="Simpan sementara ke browser"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Draft</span>
          </button>

          <button
            onClick={handleLoadDraft}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
            title="Muat draft dari browser"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Load</span>
          </button>

          {opnameStatus === 'POSTED' && (
            <button
              type="button"
              onClick={() => setIsReverseModalOpen(true)}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              title="Batalkan (Reverse) transaksi opname yang sudah diposting"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reverse Opname</span>
            </button>
          )}

          <button
            onClick={handleOpenReconciliation}
            disabled={isSubmitting || opnameItems.length === 0 || isReadOnly}
            className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
              opnameItems.length === 0 || isReadOnly
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</span>
          </button>
        </div>
      </div>

      {/* Reversed Banner if transaction is REVERSED */}
      {opnameStatus === 'REVERSED' && (
        <div className="px-5 py-2 bg-rose-500/15 border-b border-rose-500/30 flex items-center justify-between text-xs font-bold text-rose-400 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Transaksi Opname ini telah dibatalkan (REVERSED).{reversedReasonText ? ` Alasan: ${reversedReasonText}` : ''}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-black">Read-Only</span>
        </div>
      )}

      {/* 📊 SUMMARY METRICS CARDS (Unified Single Qty) */}
      <div className={`px-5 py-3.5 border-b grid grid-cols-2 md:grid-cols-4 gap-3.5 shadow-sm shrink-0 ${
        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Total Item Opname</div>
            <div className={`text-lg font-black ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
              {stats.totalItems} Barang
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Total Qty</div>
            <div className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-950'}`}>
              {stats.totalQty} Unit
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Status Transaksi</div>
            <div className={`text-lg font-black ${isDark ? 'text-indigo-300' : 'text-indigo-950'}`}>
              {opnameStatus}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Total Nilai Opname</div>
            <div className={`text-sm font-black font-mono ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
              Rp {stats.totalValue.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </div>

      {/* 📥 INLINE FAST SCAN ENTRY ROW */}
      <div
        className={`px-5 py-2.5 border-b flex flex-wrap items-center gap-3 shrink-0 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-amber-50/50 border-amber-200/60'
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-500 shrink-0">
          <BarcodeIcon className="w-4 h-4" />
          <span>Scan Barcode:</span>
        </div>

        {/* Scan Barcode / SKU */}
        <div className="w-44">
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            disabled={isReadOnly}
            onChange={(e) => handleBarcodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddItem();
              }
            }}
            placeholder="Scan Barcode / SKU..."
            className={`w-full px-3 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
            }`}
          />
        </div>

        {/* Select Barang */}
        <div className="flex-1 min-w-[220px]">
          <select
            value={selectedInvId}
            disabled={isReadOnly}
            onChange={(e) => handleInventorySelect(Number(e.target.value))}
            className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
              isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
            }`}
          >
            <option value="">-- Pilih Barang Catalog --</option>
            {inventoryList.slice(0, 300).map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.inventoryName} ({inv.inventoryNo})
              </option>
            ))}
          </select>
        </div>

        {/* Qty */}
        <div className="w-24 flex items-center gap-1">
          <span className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Qty:</span>
          <input
            type="number"
            min="0"
            disabled={isReadOnly}
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
            className={`w-full py-1 text-center font-black text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isDark ? 'bg-slate-950 text-amber-400 border-slate-700' : 'bg-white text-amber-900 border-slate-300'
            }`}
          />
        </div>

        {/* Catatan */}
        <div className="w-44">
          <input
            type="text"
            disabled={isReadOnly}
            value={descInput}
            onChange={(e) => setDescInput(e.target.value)}
            placeholder="Catatan Opname..."
            className={`w-full px-3 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          disabled={isReadOnly}
          className={`px-4 py-1.5 rounded-xl font-black text-xs shadow transition-all shrink-0 flex items-center gap-1 ${
            isReadOnly
              ? 'bg-slate-700 text-slate-400 opacity-50 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 cursor-pointer'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah</span>
        </button>
      </div>

      {/* 📊 FULL-HEIGHT TABLE WORKBENCH VIEWPORT */}
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        <div className={`flex-1 min-h-0 flex flex-col rounded-2xl border-2 shadow-lg overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
        }`}>
          {/* Table Toolbar (Item Count & Live Search) */}
          <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-black bg-amber-500 text-slate-950 shadow-sm">
                Semua ({opnameItems.length})
              </span>
              {tableSearch && (
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Menampilkan {filteredTableItems.length} dari {opnameItems.length} barang
                </span>
              )}
            </div>

            {/* Table Live Search */}
            <div className="relative min-w-[220px]">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-400" : "text-slate-600"}`} />
              <input
                type="text"
                placeholder="Filter tabel opname..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className={`w-full pl-8 pr-3 py-1 rounded-lg border text-xs font-semibold focus:outline-none ${
                  isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
                }`}
              />
            </div>
          </div>

          {/* SCROLLABLE TABLE AREA */}
          <div className="flex-1 min-h-0 overflow-auto relative">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr
                  className={"h-11 whitespace-nowrap uppercase text-[11px] font-black tracking-wider border-b-2 " + (isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-slate-200 text-slate-900 border-slate-300")}
                >
                  <th className="py-2.5 px-4 w-12 text-center">No.</th>
                  <th onClick={() => handleSort('inventoryNo')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Kode Barang</span>
                      {sortField === 'inventoryNo' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('inventoryName')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Nama Barang</span>
                      {sortField === 'inventoryName' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('qty')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors min-w-[150px]">
                    <div className="flex items-center justify-center gap-1">
                      <span>Qty</span>
                      {sortField === 'qty' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('description')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Keterangan</span>
                      {sortField === 'description' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th className="py-2.5 px-4 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-24">
                      <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mb-4 shadow-lg shadow-amber-500/20"></div>
                        <h3 className="text-lg font-black text-amber-400 tracking-wider uppercase">Sedang Mengambil Data...</h3>
                        <p className={`text-xs mt-2 font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Memuat riwayat Stok Opname dari ERP Database</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredTableItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`py-20 text-center font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {opnameItems.length === 0
                        ? 'Belum ada item opname. Gunakan form Quick Scan di atas atau klik "Load Data".'
                        : 'Tidak ada item yang sesuai dengan filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredTableItems.slice(0, 100).map((item, idx) => (
                    <tr
                      key={item.inventoryId}
                      className={"transition-colors " + (isDark ? 'hover:bg-slate-700 text-slate-100' : 'hover:bg-slate-200 odd:bg-white even:bg-white text-slate-800')}
                    >
                      <td className={`py-2.5 px-4 text-center font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="font-bold text-amber-500 block">{item.inventoryNo}</span>
                        <span className={`text-[10px] font-normal ${isDark ? "text-slate-400" : "text-slate-600"}`}>{item.barcode}</span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                        {item.inventoryName}
                      </td>

                      {/* Unified Qty - INLINE STEPPER EDIT */}
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleInlineQtyChange(item.inventoryId, item.qty - 1)}
                            className={`p-1 rounded-lg border transition-all active:scale-90 ${
                              isReadOnly
                                ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
                                : isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 cursor-pointer' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700 cursor-pointer'
                            }`}
                            title="Kurangi 1"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            disabled={isReadOnly}
                            value={item.qty}
                            onChange={(e) => handleInlineQtyChange(item.inventoryId, parseInt(e.target.value) || 0)}
                            className={`w-16 py-1 text-center font-black text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                              isDark ? 'bg-slate-950 text-amber-400 border-slate-700' : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                          />
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleInlineQtyChange(item.inventoryId, item.qty + 1)}
                            className={`p-1 rounded-lg border transition-all active:scale-90 ${
                              isReadOnly
                                ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
                                : isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 cursor-pointer' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700 cursor-pointer'
                            }`}
                            title="Tambah 1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className={`py-2.5 px-4 italic ${isDark ? "text-slate-400" : "text-slate-600"}`}>{item.description}</td>

                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.inventoryId)}
                          disabled={isReadOnly}
                          className={`p-1.5 rounded-lg text-rose-400 transition-colors ${
                            isReadOnly ? 'opacity-40 cursor-not-allowed' : 'hover:bg-rose-500/20 cursor-pointer'
                          }`}
                          title="Hapus Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* COMPACT WORKBENCH FOOTER STATS BAR */}
          <div className={`px-5 py-2.5 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300'
          }`}>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className={isDark ? "text-slate-400" : "text-slate-600"}>
                Total Barang: <strong className="text-slate-900 dark:text-white">{stats.totalItems} SKU</strong>
              </span>
              <span className={isDark ? "text-slate-400" : "text-slate-600"}>
                Total Qty: <strong className="text-amber-500">{stats.totalQty} Unit</strong>
              </span>
              <span className={isDark ? "text-slate-400" : "text-slate-600"}>
                Status: <strong className="text-indigo-400">{opnameStatus}</strong>
              </span>
            </div>

            <div className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Total Nilai Opname: <strong className="text-emerald-400 font-mono text-sm">Rp {stats.totalValue.toLocaleString('id-ID')}</strong>
            </div>
          </div>
        </div>

        {/* 🖨️ OFFICIAL SIGNATURE BOX (VISIBLE ONLY ON PRINT) */}
        <div className="print-signatures grid grid-cols-3 gap-6 text-center text-xs pt-8">
          <div>
            <div className="font-bold mb-12">Petugas Gudang:</div>
            <div className="border-b border-black w-36 mx-auto mb-1"></div>
            <div className="text-[10px] text-slate-500">Staf Opname Gudang</div>
          </div>
          <div>
            <div className="font-bold mb-12">Diperiksa Oleh:</div>
            <div className="border-b border-black w-36 mx-auto mb-1"></div>
            <div className="text-[10px] text-slate-500">Supervisor Gudang</div>
          </div>
          <div>
            <div className="font-bold mb-12">Disetujui Oleh:</div>
            <div className="border-b border-black w-36 mx-auto mb-1"></div>
            <div className="text-[10px] text-slate-500">Kepala Logistik & Gudang</div>
          </div>
        </div>

        {/* 🔮 OPNAME CONFIRMATION PREVIEW MODAL */}
        {isReconciling && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              {/* Modal Header */}
              <div className={`px-6 py-4 flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Konfirmasi Simpan Stok Opname
                    </h2>
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Pratinjau Penyesuaian Qty Gudang ({noTransaction})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReconciling(false)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body: Summary + Item List */}
              <div className={`flex-1 overflow-auto p-6 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                <div className={`p-4 rounded-2xl mb-6 flex items-center justify-between border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-amber-50 border-amber-200'}`}>
                  <div>
                    <h3 className={`font-bold ${isDark ? 'text-white' : 'text-amber-900'}`}>Konfirmasi Stok Opname</h3>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-amber-700'}`}>
                      Posting opname akan memperbarui stok akhir gudang dengan <strong>Qty</strong> yang tertera di bawah ini.
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-xl font-black text-amber-500">
                      {stats.totalQty} Unit
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Dari Total {stats.totalItems} Barang
                    </div>
                  </div>
                </div>

                <table className="w-full text-left border-separate border-spacing-0 border rounded-xl overflow-hidden">
                  <thead className={isDark ? 'bg-slate-800' : 'bg-slate-200'}>
                    <tr className="text-[11px] font-black uppercase text-slate-500">
                      <th className="px-4 py-2">Kode Barang</th>
                      <th className="px-4 py-2">Nama Barang</th>
                      <th className="px-4 py-2 text-center">Qty</th>
                      <th className="px-4 py-2 text-right">Harga Satuan</th>
                      <th className="px-4 py-2 text-right">Total Nilai</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-xs ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                    {opnameItems.slice(0, 100).map((item) => (
                      <tr key={item.inventoryId} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                        <td className="px-4 py-2 font-mono font-bold text-slate-400">{item.inventoryNo}</td>
                        <td className="px-4 py-2 font-bold text-amber-500">{item.inventoryName}</td>
                        <td className="px-4 py-2 text-center font-mono font-black">{item.qty}</td>
                        <td className="px-4 py-2 text-right font-mono">Rp {(item.price || 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400">
                          Rp {(item.qty * (item.price || 0)).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className={`px-6 py-4 border-t flex justify-between items-center gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <button
                  onClick={() => setIsReconciling(false)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
                >
                  Batal & Cek Ulang
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSubmitOpname('draft')}
                    disabled={isSubmitting}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer border ${
                      isDark ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    Simpan Draft DB
                  </button>
                  <button
                    onClick={() => handleSubmitOpname('post')}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Save className="w-4 h-4" />
                    {isSubmitting ? 'Memproses...' : 'Confirm Post Adjustment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🔄 REVERSE OPNAME MODAL */}
        {isReverseModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className={`w-full max-w-md flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              <div className={`px-6 py-4 flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Batalkan (Reverse) Opname
                    </h2>
                    <p className="text-[11px] font-mono text-rose-400">{noTransaction}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReverseModalOpen(false)}
                  className={`p-1.5 rounded-xl transition-colors cursor-pointer ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Pembatalan opname akan membuat jurnal pergerakan kompensasi dan mengembalikan saldo stok sebelum transaksi ini diposting.
                </p>
                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Alasan Pembatalan (Wajib)
                  </label>
                  <textarea
                    rows={3}
                    value={reverseReasonInput}
                    onChange={(e) => setReverseReasonInput(e.target.value)}
                    placeholder="Masukkan alasan pembatalan stok opname..."
                    className={`w-full p-3 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                      isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
                    }`}
                  />
                </div>
              </div>

              <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <button
                  onClick={() => setIsReverseModalOpen(false)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`}
                >
                  Batal
                </button>
                <button
                  onClick={handleReverseOpname}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer transition-all shadow-lg shadow-rose-600/20"
                >
                  {isSubmitting ? 'Memproses...' : 'Konfirmasi Reverse'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
