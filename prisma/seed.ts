import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Comprehensive Harmony Kitchen ERP Database via Prisma...');

  // 1. Seed Positions & Employees
  const positions = [
    { positionNo: 'POS-001', positionName: 'Manager', description: 'Manager Operasional Cabang Toko' },
    { positionNo: 'POS-002', positionName: 'Supervisor', description: 'Supervisor Persediaan & Gudang' },
    { positionNo: 'POS-003', positionName: 'Cashier', description: 'Kasir Utama & Pembayaran' },
    { positionNo: 'POS-004', positionName: 'Chef / Dapur', description: 'Kepala Koki & Persediaan Dapur' },
    { positionNo: 'POS-005', positionName: 'Staff Gudang', description: 'Staf Logistik & Receiver' },
  ];

  for (const pos of positions) {
    await prisma.position.upsert({
      where: { positionNo: pos.positionNo },
      update: { positionName: pos.positionName, description: pos.description },
      create: pos,
    });
  }

  const mgrPos = await prisma.position.findUnique({ where: { positionNo: 'POS-001' } });
  const spvPos = await prisma.position.findUnique({ where: { positionNo: 'POS-002' } });
  const csrPos = await prisma.position.findUnique({ where: { positionNo: 'POS-003' } });
  const chfPos = await prisma.position.findUnique({ where: { positionNo: 'POS-004' } });
  const stfPos = await prisma.position.findUnique({ where: { positionNo: 'POS-005' } });

  const employees = [
    { employeeNo: 'EM-00001', employeeName: 'Bambang Sudirman', positionId: mgrPos?.id, positionName: 'Manager', description: 'Penanggung jawab operasional cabang' },
    { employeeNo: 'EM-00002', employeeName: 'Rina Kartika', positionId: csrPos?.id, positionName: 'Cashier', description: 'Kasir utama toko' },
    { employeeNo: 'EM-00003', employeeName: 'Joko Widodo', positionId: spvPos?.id, positionName: 'Supervisor', description: 'Supervisor persediaan gudang' },
    { employeeNo: 'EM-00004', employeeName: 'Siti Aminah', positionId: chfPos?.id, positionName: 'Chef / Dapur', description: 'Kepala koki persediaan dapur' },
    { employeeNo: 'EM-00005', employeeName: 'Hendra Setiawan', positionId: stfPos?.id, positionName: 'Staff Gudang', description: 'Staf logistik penerimaan barang' },
    { employeeNo: 'EM-00006', employeeName: 'Dewi Lestari', positionId: csrPos?.id, positionName: 'Cashier', description: 'Kasir shift malam' },
    { employeeNo: 'EM-00007', employeeName: 'Agus Pratama', positionId: stfPos?.id, positionName: 'Staff Gudang', description: 'Staf opname & pemakaian barang' },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { employeeNo: emp.employeeNo },
      update: { employeeName: emp.employeeName, positionId: emp.positionId, positionName: emp.positionName, description: emp.description },
      create: emp,
    });
  }

  // 2. Seed Users & Permissions
  const users = [
    { username: 'admin', password: '123', fullName: 'Administrator ERP', userLevel: 'Admin' },
    { username: 'manager', password: '123', fullName: 'Manager Operasional', userLevel: 'Manager' },
    { username: 'supervisor', password: '123', fullName: 'Supervisor Gudang', userLevel: 'Supervisor' },
    { username: 'kasir', password: '123', fullName: 'Kasir Utama', userLevel: 'Kasir' },
  ];

  for (const u of users) {
    const createdUser = await prisma.user.upsert({
      where: { username: u.username },
      update: { fullName: u.fullName, userLevel: u.userLevel },
      create: u,
    });

    const allModules = [
      'MD_INV', 'MD_STOCK', 'MD_USAGE', 'MD_BARCODE', 'MD_EMP', 'MD_CUST', 'MD_BANK', 'MD_SUPP', 'MD_PROMO',
      'PUR_PR', 'PUR_PO', 'PUR_EXP', 'PUR_RCV', 'PUR_PAY', 'PUR_RET', 'INV_OPN', 'SLS_SYNC', 'SLS_MON', 'RPT_SALES', 'ADM_USER',
      'master-barang', 'inventory-stok', 'pemakaian-barang', 'cetak-barcode', 'master-karyawan', 'master-customer', 'master-bank',
      'master-supplier', 'master-promo', 'pengajuan-pembelian', 'order-pembelian', 'penerimaan-barang', 'penerimaan-barang-harga',
      'pembayaran-supplier', 'retur-pembelian', 'stok-opname', 'sync-stok', 'memo-sync-stok', 'sales-sync-stok', 'sales-monitoring',
      'laporan-penjualan', 'user-management'
    ];

    for (const modCode of allModules) {
      let canView = true;
      let canAdd = true;
      let canEdit = true;
      let canDelete = true;
      let canPrint = true;

      if (u.userLevel === 'Kasir') {
        if (modCode.includes('user') || modCode.includes('ADM') || modCode.includes('SUPP') || modCode.includes('RCV') || modCode.includes('harga')) {
          canView = false;
        }
        canDelete = false;
      } else if (u.userLevel === 'Supervisor') {
        if (modCode.includes('user') || modCode.includes('ADM')) canView = false;
        canDelete = false;
      }

      await prisma.userModulePermission.upsert({
        where: { userId_moduleCode: { userId: createdUser.id, moduleCode: modCode } },
        update: { canView, canAdd, canEdit, canDelete, canPrint },
        create: { userId: createdUser.id, moduleCode: modCode, canView, canAdd, canEdit, canDelete, canPrint },
      });
    }
  }

  // 3. Seed Customers
  const customers = [
    { customerCode: 'C-00001', customerName: 'Budi Santoso (Resto Bintang)', customerType: 'Wholesale B2B', address: 'Jl. Pemuda No. 12', city: 'Surabaya', phone: '08123456789', contactPerson: 'Budi', creditLimit: 25000000 },
    { customerCode: 'C-00002', customerName: 'Siti Rahma (VIP Gold)', customerType: 'VIP Gold', address: 'Jl. Diponegoro No. 45', city: 'Surabaya', phone: '08198765432', contactPerson: 'Siti', creditLimit: 15000000 },
    { customerCode: 'C-00003', customerName: 'Toko Kopi Jaya Abadi', customerType: 'Wholesale B2B', address: 'Jl. Raya Darmo No. 88', city: 'Surabaya', phone: '08112233445', contactPerson: 'Jaya', creditLimit: 50000000 },
    { customerCode: 'C-00004', customerName: 'Catering Berkah Utama', customerType: 'Wholesale B2B', address: 'Jl. Basuki Rahmat No. 34', city: 'Surabaya', phone: '08139988776', contactPerson: 'Berkah', creditLimit: 30000000 },
    { customerCode: 'C-00005', customerName: 'Hotel Nusantara Suites', customerType: 'Wholesale B2B', address: 'Jl. Mayjend Sungkono No. 100', city: 'Surabaya', phone: '08122233344', contactPerson: 'Nusantara', creditLimit: 100000000 },
    { customerCode: 'C-00006', customerName: 'Kafeteria Merdeka', customerType: 'Reguler', address: 'Jl. Airlangga No. 4', city: 'Surabaya', phone: '08155566677', contactPerson: 'Rizal', creditLimit: 5000000 },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { customerCode: c.customerCode },
      update: c,
      create: c,
    });
  }

  // 4. Seed Banks
  const banks = [
    { bankCode: 'BANK-001', bankName: 'Bank BCA', accountNo: '123-456-7890', accountHolder: 'PT Harmony Kitchenware' },
    { bankCode: 'BANK-002', bankName: 'Bank Mandiri', accountNo: '098-765-4321', accountHolder: 'PT Harmony Kitchenware' },
    { bankCode: 'BANK-003', bankName: 'Bank BRI', accountNo: '555-666-7777', accountHolder: 'PT Harmony Kitchenware' },
    { bankCode: 'BANK-004', bankName: 'Bank BNI', accountNo: '333-444-5555', accountHolder: 'PT Harmony Kitchenware' },
    { bankCode: 'BANK-005', bankName: 'Bank CIMB Niaga', accountNo: '888-999-0000', accountHolder: 'PT Harmony Kitchenware' },
  ];

  for (const b of banks) {
    await prisma.bankAccount.upsert({
      where: { bankCode: b.bankCode },
      update: b,
      create: b,
    });
  }

  // 5. Seed Suppliers
  const suppliers = [
    { supplierCode: 'SUP-0001', supplierName: 'PT Kitchenware Manufacture', supplierType: 'Lokal Utama', address: 'Kawasan Industri Rungkut', city: 'Surabaya', phone: '031-8989898', contactPerson: 'Hendra' },
    { supplierCode: 'SUP-0002', supplierName: 'CV Enamel Nusantara', supplierType: 'Lokal Bandung', address: 'Jl. Soekarno Hatta', city: 'Bandung', phone: '022-778899', contactPerson: 'Dewi' },
    { supplierCode: 'SUP-0003', supplierName: 'PT Tefal Coating Indonesia', supplierType: 'Importir Resmi', address: 'Kawasan Industri Pulogadung', city: 'Jakarta', phone: '021-445566', contactPerson: 'Kevin' },
    { supplierCode: 'SUP-0004', supplierName: 'PT Philips Electronics Indonesia', supplierType: 'Importir Elektronik', address: 'Jl. Jend Sudirman', city: 'Jakarta', phone: '021-525252', contactPerson: 'Anton' },
    { supplierCode: 'SUP-0005', supplierName: 'CV Kayu Jati Permai', supplierType: 'Pengrajin Kayu', address: 'Jl. Raya Jepara', city: 'Jepara', phone: '0291-595959', contactPerson: 'Sutrisno' },
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { supplierCode: s.supplierCode },
      update: s,
      create: s,
    });
  }

  // 6. Seed Categories, Brands, UoM & Inventories
  const catKopi = await prisma.category.upsert({ where: { categoryCode: 'CAT-001' }, update: {}, create: { categoryCode: 'CAT-001', categoryName: 'Peralatan Kopi' } });
  const catEnamel = await prisma.category.upsert({ where: { categoryCode: 'CAT-002' }, update: {}, create: { categoryCode: 'CAT-002', categoryName: 'Enamel & Cangkir' } });
  const catWajan = await prisma.category.upsert({ where: { categoryCode: 'CAT-003' }, update: {}, create: { categoryCode: 'CAT-003', categoryName: 'Wajan & Panci' } });
  const catElektronik = await prisma.category.upsert({ where: { categoryCode: 'CAT-004' }, update: {}, create: { categoryCode: 'CAT-004', categoryName: 'Elektronik Dapur' } });
  const catUtensils = await prisma.category.upsert({ where: { categoryCode: 'CAT-005' }, update: {}, create: { categoryCode: 'CAT-005', categoryName: 'Utensil & Kayu' } });

  const brandEris = await prisma.brand.upsert({ where: { brandCode: 'BRD-001' }, update: {}, create: { brandCode: 'BRD-001', brandName: 'ERIS' } });
  const brandArj = await prisma.brand.upsert({ where: { brandCode: 'BRD-002' }, update: {}, create: { brandCode: 'BRD-002', brandName: 'ARJ' } });
  const brandTefal = await prisma.brand.upsert({ where: { brandCode: 'BRD-003' }, update: {}, create: { brandCode: 'BRD-003', brandName: 'Tefal' } });
  const brandPhilips = await prisma.brand.upsert({ where: { brandCode: 'BRD-004' }, update: {}, create: { brandCode: 'BRD-004', brandName: 'Philips' } });
  const brandMaster = await prisma.brand.upsert({ where: { brandCode: 'BRD-005' }, update: {}, create: { brandCode: 'BRD-005', brandName: 'ChefMaster' } });

  const uomClient = (prisma as any).uoM || (prisma as any).uOM || (prisma as any).uom;
  const uomPcs = await uomClient.upsert({ where: { uomCode: 'UOM-001' }, update: {}, create: { uomCode: 'UOM-001', uomName: 'Pcs' } });
  const uomSet = await uomClient.upsert({ where: { uomCode: 'UOM-002' }, update: {}, create: { uomCode: 'UOM-002', uomName: 'Set' } });
  const uomBox = await uomClient.upsert({ where: { uomCode: 'UOM-003' }, update: {}, create: { uomCode: 'UOM-003', uomName: 'Box' } });

  const inventories = [
    { barcode: '8801234000011', inventoryNo: 'INV-00001', inventoryName: 'ERIS Coffee Grinder Manual Kayu Premium', categoryId: catKopi.id, brandId: brandEris.id, uomId: uomPcs.id, hpp: 60000, price: 85000, stock: 24 },
    { barcode: '8801234000028', inventoryNo: 'INV-00002', inventoryName: 'OTC Coffee Grinder Manual Classic Stainless', categoryId: catKopi.id, brandId: brandEris.id, uomId: uomPcs.id, hpp: 55000, price: 80000, stock: 30 },
    { barcode: '8801234000059', inventoryNo: 'INV-00003', inventoryName: 'ARJ Mug Enamel Ayam Jago Tutup 9cm', categoryId: catEnamel.id, brandId: brandArj.id, uomId: uomPcs.id, hpp: 15000, price: 25000, stock: 50 },
    { barcode: '8801234000110', inventoryNo: 'INV-00004', inventoryName: 'Wok Pan Anti Lengket Tefal Coating 32cm', categoryId: catWajan.id, brandId: brandTefal.id, uomId: uomPcs.id, hpp: 180000, price: 245000, stock: 12 },
    { barcode: '8801234000127', inventoryNo: 'INV-00005', inventoryName: 'Philips Hand Mixer 300W 5 Speed Turbo', categoryId: catElektronik.id, brandId: brandPhilips.id, uomId: uomPcs.id, hpp: 280000, price: 350000, stock: 15 },
    { barcode: '8801234000134', inventoryNo: 'INV-00006', inventoryName: 'ChefMaster Talenan Kayu Jati Premium 40x25cm', categoryId: catUtensils.id, brandId: brandMaster.id, uomId: uomPcs.id, hpp: 75000, price: 110000, stock: 20 },
    { barcode: '8801234000141', inventoryNo: 'INV-00007', inventoryName: 'ChefMaster Set Pisau Dapur Stainless Steel 5 in 1', categoryId: catUtensils.id, brandId: brandMaster.id, uomId: uomSet.id, hpp: 120000, price: 175000, stock: 18 },
  ];

  for (const inv of inventories) {
    await prisma.inventory.upsert({
      where: { barcode: inv.barcode },
      update: inv,
      create: inv,
    });
  }

  // 7. Seed Transactions: Pemakaian Barang Internal
  await prisma.inventoryUsageHeader.create({
    data: {
      usageNo: 'USG-202608-001',
      usageDate: new Date(),
      whName: 'Gudang Utama',
      description: 'Pemakaian 2 Pcs Wok Pan untuk Dapur Utama Resto',
      details: {
        create: [
          { barcode: '8801234000110', inventoryNo: 'INV-00004', inventoryName: 'Wok Pan Anti Lengket Tefal Coating 32cm', qty: 2, uomName: 'Pcs', notes: 'Dapur Utama' },
        ],
      },
    },
  });

  // 8. Seed Transactions: Stock Opname
  await prisma.opnameHeader.create({
    data: {
      opnameNo: 'OPN-202608-001',
      opnameDate: new Date(),
      whName: 'Gudang Utama',
      details: {
        create: [
          { barcode: '8801234000011', inventoryNo: 'INV-00001', inventoryName: 'ERIS Coffee Grinder Manual Kayu Premium', systemQty: 25, physicalQty: 24, diffQty: -1 },
          { barcode: '8801234000059', inventoryNo: 'INV-00003', inventoryName: 'ARJ Mug Enamel Ayam Jago Tutup 9cm', systemQty: 50, physicalQty: 50, diffQty: 0 },
        ],
      },
    },
  });

  // 9. Seed Transactions: Purchase Request (PR)
  await prisma.purchaseRequestHeader.create({
    data: {
      prNo: 'PR-202608-001',
      prDate: new Date(),
      requiredDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      description: 'Pengajuan Pembelian Tambahan Grinder & Mug Enamel',
      status: 'Approved',
      details: {
        create: [
          { barcode: '8801234000011', inventoryNo: 'INV-00001', inventoryName: 'ERIS Coffee Grinder Manual Kayu Premium', qty: 10, uomName: 'Pcs', notes: 'Stok Kopi Resto' },
          { barcode: '8801234000059', inventoryNo: 'INV-00003', inventoryName: 'ARJ Mug Enamel Ayam Jago Tutup 9cm', qty: 30, uomName: 'Pcs', notes: 'Stok Souvenir' },
        ],
      },
    },
  });

  // 10. Seed Transactions: Purchase Order (PO)
  await prisma.purchaseOrderHeader.create({
    data: {
      poNo: 'PO-202608-001',
      poDate: new Date(),
      supplierName: 'PT Kitchenware Manufacture',
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      description: 'Order Restock Panci Tefal & Mixer Philips',
      subtotal: 4600000,
      tax: 506000,
      grandTotal: 5106000,
      status: 'Approved',
      details: {
        create: [
          { barcode: '8801234000110', inventoryNo: 'INV-00004', inventoryName: 'Wok Pan Anti Lengket Tefal Coating 32cm', qty: 10, unitPrice: 180000, subtotal: 1800000 },
          { barcode: '8801234000127', inventoryNo: 'INV-00005', inventoryName: 'Philips Hand Mixer 300W 5 Speed Turbo', qty: 10, unitPrice: 280000, subtotal: 2800000 },
        ],
      },
    },
  });

  // 11. Seed Transactions: Material Receivement (MR Express & Priced)
  await prisma.materialReceiveHeader.create({
    data: {
      mrNo: 'MR-EXP-202608-001',
      mrDate: new Date(),
      poNo: 'PO-202608-001',
      supplierName: 'PT Kitchenware Manufacture',
      isPriced: false,
      details: {
        create: [
          { barcode: '8801234000110', inventoryNo: 'INV-00004', inventoryName: 'Wok Pan Anti Lengket Tefal Coating 32cm', qty: 10, unitPrice: 0, subtotal: 0 },
        ],
      },
    },
  });

  await prisma.materialReceiveHeader.create({
    data: {
      mrNo: 'MR-PRC-202608-001',
      mrDate: new Date(),
      poNo: 'PO-202608-001',
      supplierName: 'PT Kitchenware Manufacture',
      isPriced: true,
      details: {
        create: [
          { barcode: '8801234000127', inventoryNo: 'INV-00005', inventoryName: 'Philips Hand Mixer 300W 5 Speed Turbo', qty: 10, unitPrice: 280000, subtotal: 2800000 },
        ],
      },
    },
  });

  // 12. Seed Transactions: Purchase Payment
  await prisma.purchasePaymentHeader.create({
    data: {
      paymentNo: 'PAY-202608-001',
      paymentDate: new Date(),
      supplierName: 'PT Kitchenware Manufacture',
      bankName: 'Bank BCA',
      referenceNo: 'TRX-BCA-987654',
      grandTotal: 2800000,
      details: {
        create: [
          { invoiceNo: 'INV-MR-PRC-202608-001', amountPaid: 2800000 },
        ],
      },
    },
  });

  // 13. Seed Transactions: Purchase Return
  await prisma.purchaseReturnHeader.create({
    data: {
      returnNo: 'RET-202608-001',
      returnDate: new Date(),
      mrNo: 'MR-EXP-202608-001',
      supplierName: 'PT Kitchenware Manufacture',
      returnReason: 'Dus kemasan penyok saat pengiriman',
      details: {
        create: [
          { barcode: '8801234000110', inventoryNo: 'INV-00004', inventoryName: 'Wok Pan Anti Lengket Tefal Coating 32cm', qty: 1 },
        ],
      },
    },
  });

  // 14. Seed Transactions: Sales POS & Monitoring
  await prisma.salesPOSHeader.create({
    data: {
      salesPOSNo: 'POS-202608-001',
      salesPOSDate: new Date(),
      customerName: 'Budi Santoso (Resto Bintang)',
      totalAmount: 370000,
      discountAmount: 37000,
      grandTotal: 333000,
      cashierName: 'Rina Kartika',
      status: 'COMPLETED',
      details: {
        create: [
          { barcode: '8801234000011', inventoryNo: 'INV-00001', inventoryName: 'ERIS Coffee Grinder Manual Kayu Premium', qty: 2, price: 85000, subtotal: 170000 },
          { barcode: '8801234000059', inventoryNo: 'INV-00003', inventoryName: 'ARJ Mug Enamel Ayam Jago Tutup 9cm', qty: 8, price: 25000, subtotal: 200000 },
        ],
      },
    },
  });

  // 15. Seed Promos
  const promoGrp = await prisma.promoGroup.create({ data: { groupName: 'Promo Peralatan Dapur Utama' } });
  await prisma.promo.upsert({
    where: { promoNo: 'PRM-2026-001' },
    update: {},
    create: {
      promoNo: 'PRM-2026-001',
      promoName: 'Diskon Akhir Pekan Kitchenware 10%',
      groupId: promoGrp.id,
      discountPct: 10,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  // 16. Seed Memos
  await prisma.memo.upsert({
    where: { memoNo: 'MEM-001' },
    update: {},
    create: {
      memoNo: 'MEM-001',
      title: 'Pemberitahuan Sync Stok Cabang Rungkut',
      content: 'Proses sinkronisasi stok akhir bulan wajib dilakukan sebelum jam 17.00 WIB.',
      author: 'Manager Operasional',
      status: 'OPEN',
    },
  });

  console.log('Seeding finished successfully with rich transactional data for all ERP pages!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
