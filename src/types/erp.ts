export interface ERPProduct {
  id: string;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  inventoryBrandId?: number;
  brandName?: string;
  inventoryCategoryId?: number;
  categoryName?: string;
  inventoryProductId?: number;
  productName?: string;
  uoMId?: number;
  uomName?: string;
  minStock: number;
  maxStock: number;
  kodeHarga: string;
  description: string;
  price: number; // Harga Jual Retail
  disc: number;
  isActive: boolean;
  hpp: number; // HPP / Cost Price
  priceBuy: number;
  grosir1: number;
  grosir2: number;
  grosir3: number;
  disc1?: number;
  disc2?: number;
  stokAwal: number;
  stokAkhir: number;
  stokUpdate?: number;
  modifiedUser?: string;
  modifiedDate?: string;
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
  supplierType?: string;
  address: string;
  city: string;
  phone1: string;
  phone2?: string;
  fax?: string;
  bankId?: string;
  bankAccount?: string;
  onBehalfOf?: string;
  creditLimit?: number;
  contactPerson: string;
  contactPersonAddress?: string;
  contactPersonPhone1?: string;
  contactPersonPhone2?: string;
  email?: string;
  taxNo?: string;
  isTaxable?: boolean;
  description?: string;
  isActive?: boolean;
  modifiedDate?: string;
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
