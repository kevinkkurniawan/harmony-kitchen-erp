export interface ERPProduct {
  id: string;
  noBarang: string;
  barcode: string;
  nama: string;
  description: string;
  kode: string;
  hargaRetail: number;
  grosir1: number;
  grosir2: number;
  grosir3: number;
  hargaBeli: number;
  grPr: string;
  stok: number;
}

export interface StockSyncItem {
  id: string;
  namaBarang: string;
  grup: string;
  etalase: string;
  gudang: string;
  invStok: number;
  rtStok: number;
  status: 'OK' | 'Perlu Sync';
  lastSync: string;
}

export interface PromoRule {
  id: string;
  promoName: string;
  tiers: {
    tierName: string;
    qtyMin: number;
    qtyMax: number;
    keterangan: string;
  }[];
}

export interface Supplier {
  id: string;
  supplierNo: string;
  supplierName: string;
  supplierType: string;
  address: string;
  city: string;
  phone1: string;
  phone2: string;
  fax: string;
  bankId: string;
  bankAccount: string;
  onBehalfOf: string;
  creditLimit: number;
  contactPerson: string;
  email: string;
  modifiedDate: string;
}

export interface GoodsReceiptItem {
  id: string;
  barangName: string;
  qty: number;
  harga: number;
  description: string;
}

export interface GoodsReceipt {
  id: string;
  mrNo: string;
  mrDate: string;
  supplier: string;
  keterangan: string;
  orderNo: string;
  gudangTujuan: string;
  items: GoodsReceiptItem[];
}

export interface SalesMonitoringRow {
  id: string;
  user: string;
  noNota: string;
  jenisBayar: 'Credit Card' | 'Cash' | 'Qris';
  bank: string;
  nomTransaksi: number;
  diskonAkhir: number;
  nomBayar: number;
  changeVal: number;
  keterangan: string;
  tunai: number;
  debit: number;
  qris: number;
  cc: number;
}

export interface SalesReportDailyRow {
  tanggal: string;
  tunai: number;
  debit: number;
  kredit: number;
  qris: number;
  lainLain: number;
  totalHarian: number;
}
