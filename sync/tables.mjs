// Tables copied from the legacy SQL Server database into Postgres, in foreign-key order
// (parents before children). Reconcile deletes run in reverse order.
//
//   name     table name, identical on both sides
//   pk       primary key columns in Postgres (used for ON CONFLICT and reconcile)
//   changed  legacy column that moves when a row is edited; null = no such column
//   seq      true when Postgres generates `id` from a sequence (bumped to the trial range by setup)
//   idCol    ever-increasing legacy column used to pick up new rows (default: `id` when present)
//   trialKey column that is >= TRIAL_ID_START on rows entered in the new app (default: `id` when seq).
//            The nightly reconcile only deletes rows below it; tables without one are never pruned.
//   exclude  columns never copied
//
// Columns that exist only in Postgres are left alone; only columns present on both sides are copied.

export const TABLES = [
  // master data
  { name: 'm_account', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_bank', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_brand', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_category', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_currency', pk: ['code'], changed: 'modifieddate', seq: false },
  { name: 'm_customer', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_position', pk: ['id'], changed: null, seq: true },
  { name: 'm_employee', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_uom', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_uomdetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_product', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_type', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_inventory', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_inventorymemo', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_paymenttype', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_promo', pk: ['promobundle', 'promogrosir', 'ispartial', 'isgroup'], changed: 'modifieddate', seq: false },
  { name: 'm_sales', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_supp_cust', pk: ['supp_cust_code'], changed: 'modifieddate', seq: false },
  { name: 'm_supplier', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_warehouse', pk: ['whno'], changed: 'modifieddate', seq: false },
  { name: 'm_montlymaterial', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 'm_user', pk: ['id'], changed: 'modifieddate', seq: true, exclude: ['password'] },

  // POS sales
  { name: 't_salesposheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_salesposdetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_salespayment', pk: ['salesposid'], changed: 'modifieddate', seq: false, idCol: 'salesposid', trialKey: 'salesposid' },
  { name: 't_salespospromo', pk: ['posdetid', 'promobundle'], changed: null, seq: false, idCol: 'posdetid', trialKey: 'posdetid' },
  { name: 't_customerhistory', pk: ['customerid', 'transactionid'], changed: null, seq: false, trialKey: 'transactionid' },

  // wholesale, sales orders, shipping
  { name: 't_salesgrosirheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_salesgrosirdetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_salesgrosirpayment', pk: ['sgid'], changed: 'modifieddate', seq: false, idCol: 'sgid', trialKey: 'sgid' },
  { name: 't_salesorderheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_salesorderdetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_salesshippingheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_salesshippingdetail', pk: ['id'], changed: 'modifieddate', seq: true },

  // purchasing
  { name: 't_purchaserequisitionheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_purchaserequisitiondetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_purchaseorderheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_purchaseorderdetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_materialreceiveheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_materialreceivedetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_purchasepaymentheader', pk: ['ppno', 'supplierid'], changed: 'modifieddate', seq: false },
  { name: 't_purchasepaymentdetail', pk: ['ppid', 'mrid'], changed: 'modifieddate', seq: false, trialKey: 'mrid' },

  // warehouse
  { name: 't_whtransferheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_whtransferdetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_whoutheader', pk: ['id'], changed: 'modifieddate', seq: false },
  { name: 't_memoheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_memodetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_opname', pk: ['notransaction', 'inventoryid'], changed: 'modifieddate', seq: false },

  // cash, bank, monthly
  { name: 't_banktransfer', pk: ['banktransferno', 'bankid'], changed: 'modifieddate', seq: false },
  { name: 't_banktransferheader', pk: ['id'], changed: 'modifieddate', seq: false },
  { name: 't_banktransferdetail', pk: ['banktransferid', 'bankid'], changed: 'modifieddate', seq: false, trialKey: 'banktransferid' },
  { name: 't_bankflowheader', pk: ['id'], changed: null, seq: true },
  { name: 't_bankflowdetail', pk: ['invoicedate', 'bankid'], changed: 'modifieddate', seq: false },
  { name: 't_invoicememoheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_invoicememodetail', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_salesdailysummary', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_monthlyheader', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 't_monthlydetail', pk: ['id'], changed: 'modifieddate', seq: true },

  // stock ledger, as legacy computed it
  { name: 's_stockinventory', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 's_flowinventory', pk: ['id'], changed: 'modifieddate', seq: true },
  { name: 's_flowdetailinventory', pk: ['id'], changed: 'modifieddate', seq: true },
];
