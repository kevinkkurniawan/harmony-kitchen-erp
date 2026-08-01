import { ERPProduct, StockSyncItem, PromoRule, Supplier, GoodsReceipt, SalesMonitoringRow, SalesReportDailyRow } from '@/types/erp';

export const MOCK_ERP_PRODUCTS: ERPProduct[] = [
  {
    id: '1',
    noBarang: 'BRG-001',
    barcode: '0000260500548',
    nama: 'ERIS Coffee Grinder Manual Kayu',
    description: 'Bahan kayu mahoni asli, grinder keramik',
    kode: 'KD-01',
    hargaRetail: 85000,
    grosir1: 80000,
    grosir2: 82500,
    grosir3: 78000,
    hargaBeli: 60000,
    grPr: 'K1',
    stok: 12,
  },
  {
    id: '2',
    noBarang: 'BRG-002',
    barcode: '0000250600395',
    nama: 'Maspion Rice Bucket USA B-1015 14L',
    description: 'Termos nasi dan es batu 14 liter',
    kode: 'KD-02',
    hargaRetail: 225000,
    grosir1: 210000,
    grosir2: 215000,
    grosir3: 200000,
    hargaBeli: 149677,
    grPr: 'K1',
    stok: 8,
  },
  {
    id: '3',
    noBarang: 'BRG-003',
    barcode: '0000240900436',
    nama: '+ Biaya Admin 1000',
    description: 'Biaya admin transaksi',
    kode: 'ADM-1k',
    hargaRetail: 1000,
    grosir1: 1000,
    grosir2: 1000,
    grosir3: 1000,
    hargaBeli: 1000,
    grPr: 'K1',
    stok: -3960,
  },
  {
    id: '4',
    noBarang: 'BRG-004',
    barcode: '0000250300684',
    nama: '+ Bunga Parcel 20k',
    description: 'Bunga pita dekorasi parcel',
    kode: 'DEC-20',
    hargaRetail: 20000,
    grosir1: 20000,
    grosir2: 20000,
    grosir3: 20000,
    hargaBeli: 20000,
    grPr: 'K1',
    stok: -7,
  },
  {
    id: '5',
    noBarang: 'BRG-005',
    barcode: '000002101439',
    nama: '+ Rotan Keranjang L',
    description: 'SML Satu set harga XG',
    kode: 'RTN-L',
    hargaRetail: 80000,
    grosir1: 80000,
    grosir2: 80000,
    grosir3: 80000,
    hargaBeli: 40000,
    grPr: 'K1',
    stok: 2,
  },
];

export const MOCK_STOCK_SYNC: StockSyncItem[] = [
  { id: '1', namaBarang: 'Delvonta Water Jug 11.8L', grup: 'Peralatan', etalase: 'E-01', gudang: 'GD-UTAMA', invStok: 0, rtStok: 0, status: 'OK', lastSync: '10 Aug 2026' },
  { id: '2', namaBarang: 'Lion Star Chopping Board CH-4 (XL)', grup: 'Peralatan', etalase: 'E-02', gudang: 'GD-UTAMA', invStok: 34, rtStok: 34, status: 'OK', lastSync: '08 Oct 2025' },
  { id: '3', namaBarang: 'Jawa Steamer Pancaguna 22cm', grup: 'Peralatan', etalase: 'E-03', gudang: 'GD-UTAMA', invStok: 5, rtStok: 0, status: 'Perlu Sync', lastSync: '13 Jun 2025' },
  { id: '4', namaBarang: 'Jawa Steamer Pancaguna 33cm', grup: 'Peralatan', etalase: 'E-03', gudang: 'GD-UTAMA', invStok: 9, rtStok: 9, status: 'OK', lastSync: '15 Apr 2026' },
  { id: '5', namaBarang: 'Muliya Dutch Oven 16cm Glass Lid', grup: 'Peralatan', etalase: 'E-04', gudang: 'GD-UTAMA', invStok: 8, rtStok: 8, status: 'OK', lastSync: '26 Jun 2026' },
];

export const MOCK_PROMO_RULES: PromoRule[] = [
  {
    id: '1',
    promoName: 'Promo Name: K1',
    tiers: [
      { tierName: 'Grosir - 1', qtyMin: 120, qtyMax: 999, keterangan: '-' },
      { tierName: 'Grosir - 2', qtyMin: 60, qtyMax: 119, keterangan: '-' },
      { tierName: 'Grosir - 3', qtyMin: 12, qtyMax: 59, keterangan: '-' },
    ],
  },
  {
    id: '2',
    promoName: 'Promo Name: K2',
    tiers: [
      { tierName: 'Grosir - 1', qtyMin: 61, qtyMax: 999, keterangan: '-' },
      { tierName: 'Grosir - 2', qtyMin: 30, qtyMax: 60, keterangan: '-' },
      { tierName: 'Grosir - 3', qtyMin: 6, qtyMax: 29, keterangan: '-' },
    ],
  },
  {
    id: '3',
    promoName: 'Promo Name: K3',
    tiers: [
      { tierName: 'Grosir - 3', qtyMin: 3, qtyMax: 12, keterangan: '-' },
    ],
  },
];

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: '1', supplierNo: 'S00001', supplierName: 'PT. Multimix', supplierType: 'Distributor', address: 'Jl. Industri No 12', city: 'Surabaya', phone1: '031-888123', phone2: '-', fax: '-', bankId: 'BCA', bankAccount: '1234567890', onBehalfOf: 'PT Multimix', creditLimit: 50000000, contactPerson: 'Budi', email: 'sales@multimix.co.id', modifiedDate: '8/19/2024' },
  { id: '2', supplierNo: 'S00002', supplierName: 'Maspion Group', supplierType: 'Prabrik', address: 'Gedangan Sidoarjo', city: 'Sidoarjo', phone1: '031-891100', phone2: '-', fax: '-', bankId: 'Mandiri', bankAccount: '0987654321', onBehalfOf: 'Maspion', creditLimit: 100000000, contactPerson: 'Hendra', email: 'info@maspion.com', modifiedDate: '8/21/2024' },
  { id: '3', supplierNo: 'S00003', supplierName: 'ETC', supplierType: 'Importir', address: 'Kawasan Margomulyo', city: 'Surabaya', phone1: '031-748999', phone2: '-', fax: '-', bankId: 'BCA', bankAccount: '4455667788', onBehalfOf: 'ETC Hardware', creditLimit: 30000000, contactPerson: 'Lia', email: 'support@etc.id', modifiedDate: '8/22/2024' },
];

export const MOCK_GOODS_RECEIPTS: GoodsReceipt[] = [
  {
    id: '1',
    mrNo: 'MR-260724-001',
    mrDate: '24 Jul 2026',
    supplier: 'Maspion Group',
    keterangan: 'Penerimaan Barang Express',
    orderNo: 'MR-260727-002',
    gudangTujuan: 'Gudang Utama',
    items: [
      { id: '1', barangName: 'Cookmaster Slotted Spoon CMV-0255SP', qty: 12, harga: 45000, description: '-' },
      { id: '2', barangName: 'Sinda Baskom Stainless Tebal 26cm', qty: 60, harga: 18000, description: '-' },
      { id: '3', barangName: 'Tote Bag 38x45cm', qty: 72, harga: 5000, description: '-' },
    ],
  },
  {
    id: '2',
    mrNo: 'MR-260727-002',
    mrDate: '27 Jul 2026',
    supplier: 'ETC',
    keterangan: 'Order Rutin Peralatan',
    orderNo: 'MR-260727-002',
    gudangTujuan: 'Gudang Utama',
    items: [
      { id: '1', barangName: 'Cookmaster Bread Box SUS304', qty: 12, harga: 120000, description: '-' },
      { id: '2', barangName: 'Cookmaster Ladle Irus Bakso 9cm', qty: 36, harga: 15000, description: '-' },
    ],
  },
];

export const MOCK_SALES_MONITORING: SalesMonitoringRow[] = [
  { id: '1', user: 'K/lia', noNota: 'PS260731004', jenisBayar: 'Credit Card', bank: 'BCA', nomTransaksi: 97000, diskonAkhir: 0, nomBayar: 97000, changeVal: 0, keterangan: '-', tunai: 0, debit: 0, qris: 0, cc: 97000 },
  { id: '2', user: 'K/lia', noNota: 'PS260731006', jenisBayar: 'Credit Card', bank: 'Mandiri', nomTransaksi: 440000, diskonAkhir: 0, nomBayar: 440000, changeVal: 0, keterangan: '-', tunai: 0, debit: 0, qris: 0, cc: 440000 },
  { id: '3', user: 'K/lia', noNota: 'PS260731026', jenisBayar: 'Cash', bank: '-', nomTransaksi: 1240000, diskonAkhir: 0, nomBayar: 1300000, changeVal: 60000, keterangan: '-', tunai: 1240000, debit: 0, qris: 0, cc: 0 },
  { id: '4', user: 'K/lia', noNota: 'PS260731037', jenisBayar: 'Cash', bank: '-', nomTransaksi: 2040500, diskonAkhir: 0, nomBayar: 2040500, changeVal: 0, keterangan: '-', tunai: 2040500, debit: 0, qris: 0, cc: 0 },
  { id: '5', user: 'K/lia', noNota: 'PS260731055', jenisBayar: 'Qris', bank: 'BCA', nomTransaksi: 45000, diskonAkhir: 0, nomBayar: 45000, changeVal: 0, keterangan: '-', tunai: 0, debit: 0, qris: 45000, cc: 0 },
  { id: '6', user: 'K/lia', noNota: 'PS260731059', jenisBayar: 'Cash', bank: '-', nomTransaksi: 38000, diskonAkhir: 0, nomBayar: 50000, changeVal: 12000, keterangan: '-', tunai: 38000, debit: 0, qris: 0, cc: 0 },
  { id: '7', user: 'K/lia', noNota: 'PS260731062', jenisBayar: 'Cash', bank: '-', nomTransaksi: 2295000, diskonAkhir: 0, nomBayar: 2300000, changeVal: 5000, keterangan: 'MBAK SULIS', tunai: 2295000, debit: 0, qris: 0, cc: 0 },
  { id: '8', user: 'linda', noNota: 'PS260731001', jenisBayar: 'Cash', bank: '-', nomTransaksi: 17000, diskonAkhir: 0, nomBayar: 17000, changeVal: 0, keterangan: '-', tunai: 17000, debit: 0, qris: 0, cc: 0 },
  { id: '9', user: 'linda', noNota: 'PS260731005', jenisBayar: 'Qris', bank: 'BCA', nomTransaksi: 27000, diskonAkhir: 0, nomBayar: 27000, changeVal: 0, keterangan: 'MAS KUR', tunai: 0, debit: 0, qris: 27000, cc: 0 },
  { id: '10', user: 'linda', noNota: 'PS260731009', jenisBayar: 'Credit Card', bank: 'BCA', nomTransaksi: 80000, diskonAkhir: 0, nomBayar: 80000, changeVal: 0, keterangan: '-', tunai: 0, debit: 0, qris: 0, cc: 80000 },
];

export const MOCK_SALES_REPORT_DAILY: SalesReportDailyRow[] = [
  { tanggal: '01 Jul 2026', tunai: 3872500, debit: 2334000, kredit: 5668500, qris: 1486500, lainLain: 0, totalHarian: 13361500 },
  { tanggal: '02 Jul 2026', tunai: 5597000, debit: 460000, kredit: 2693500, qris: 2409000, lainLain: 0, totalHarian: 11159500 },
  { tanggal: '03 Jul 2026', tunai: 6721500, debit: 197000, kredit: 3079500, qris: 2004500, lainLain: 0, totalHarian: 12002500 },
  { tanggal: '04 Jul 2026', tunai: 6470500, debit: 0, kredit: 3614000, qris: 1384000, lainLain: 0, totalHarian: 11468500 },
  { tanggal: '05 Jul 2026', tunai: 4124500, debit: 0, kredit: 7461500, qris: 2891500, lainLain: 0, totalHarian: 14477500 },
  { tanggal: '06 Jul 2026', tunai: 6170500, debit: 1634500, kredit: 5989000, qris: 3743500, lainLain: 0, totalHarian: 17537500 },
  { tanggal: '07 Jul 2026', tunai: 5170000, debit: 2288500, kredit: 5598000, qris: 1287000, lainLain: 0, totalHarian: 14343500 },
  { tanggal: '31 Jul 2026', tunai: 7719000, debit: 228000, kredit: 3948500, qris: 1815000, lainLain: 0, totalHarian: 13710500 },
];
