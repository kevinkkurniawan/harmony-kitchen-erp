// Tables copied from the legacy SQL Server database into Postgres, in foreign-key order
// (parents before children). Deletes run in reverse order.
//
// Only tables the new ERP or POS actually reads are listed; the rest of the legacy database is not copied.
//
//   name     table name, identical on both sides (legacy names are matched case-insensitively)
//   pk       primary key columns in Postgres (used for ON CONFLICT and deletes)
//   seq      true when Postgres generates `id` from a sequence (bumped to the trial range by setup.mjs)
//   recent   large tables only: legacy date column used to limit the frequent passes to recent rows;
//            the periodic full pass still compares every row
//   trialKey column that is >= TRIAL_ID_START on rows entered in the new app (default: `id` when seq).
//            Only used when the agent starts without its local cache, to remove Postgres rows that
//            are not in legacy; tables without one are never pruned that way.
//   exclude  columns never copied
//
// Legacy ModifiedDate is not trusted: many stored procedures (POS void, discount recalcs, stock updates)
// change rows without touching it. The agent compares row contents instead (see sync.mjs).
// Columns that exist only in Postgres are left alone; only columns present on both sides are copied.
// The exception is the estimated HPP on t_salesposdetail, which sync.mjs fills in after each pass.

export const TABLES = [
  // master data
  { name: 'm_account', pk: ['id'], seq: true },
  { name: 'm_brand', pk: ['id'], seq: true },
  { name: 'm_category', pk: ['id'], seq: true },
  { name: 'm_customer', pk: ['id'], seq: true },
  { name: 'm_position', pk: ['id'], seq: true },
  { name: 'm_employee', pk: ['id'], seq: true },
  { name: 'm_uom', pk: ['id'], seq: true },
  { name: 'm_product', pk: ['id'], seq: true },
  { name: 'm_warehouse', pk: ['whno'], seq: false },
  { name: 'm_inventory', pk: ['id'], seq: true },
  { name: 'm_paymenttype', pk: ['id'], seq: true },
  { name: 'm_promo', pk: ['promobundle', 'promogrosir', 'ispartial', 'isgroup'], seq: false },
  { name: 'm_supplier', pk: ['id'], seq: true },
  { name: 'm_user', pk: ['id'], seq: true, exclude: ['password'] },

  // POS sales
  { name: 't_salesposheader', pk: ['id'], seq: true, recent: 'createddate' },
  { name: 't_salesposdetail', pk: ['id'], seq: true, recent: 'createddate' },
  { name: 't_salespayment', pk: ['salesposid'], seq: false, recent: 'createddate', trialKey: 'salesposid' },

  // purchasing
  { name: 't_purchaserequisitionheader', pk: ['id'], seq: true },
  { name: 't_purchaserequisitiondetail', pk: ['id'], seq: true },
  { name: 't_purchaseorderheader', pk: ['id'], seq: true },
  { name: 't_purchaseorderdetail', pk: ['id'], seq: true },
  { name: 't_materialreceiveheader', pk: ['id'], seq: true },
  { name: 't_materialreceivedetail', pk: ['id'], seq: true },
  { name: 't_purchasepaymentheader', pk: ['ppno', 'supplierid'], seq: false },
  { name: 't_purchasepaymentdetail', pk: ['ppid', 'mrid'], seq: false, trialKey: 'mrid' },

  // returns, usage, stock opname
  { name: 't_memoheader', pk: ['id'], seq: true },
  { name: 't_memodetail', pk: ['id'], seq: true },
  { name: 't_opname', pk: ['notransaction', 'inventoryid'], seq: false },

  // stock ledger, as legacy computed it
  { name: 's_stockinventory', pk: ['id'], seq: true },
  { name: 's_flowinventory', pk: ['id'], seq: true },
  { name: 's_flowdetailinventory', pk: ['id'], seq: true, recent: 'createddate' },
];
