import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Harmony Kitchen ERP PostgreSQL Database via Prisma...');

  // 1. Seed Positions & Employees
  const positions = [
    { positionNo: 'POS-001', positionName: 'Manager', description: 'Manager Operasional Cabang Toko' },
    { positionNo: 'POS-002', positionName: 'Supervisor', description: 'Supervisor Persediaan & Gudang' },
    { positionNo: 'POS-003', positionName: 'Cashier', description: 'Kasir Utama & Pembayaran' },
    { positionNo: 'POS-004', positionName: 'Staff', description: 'Staf Operasional & Pelayanan' },
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
  const stfPos = await prisma.position.findUnique({ where: { positionNo: 'POS-004' } });

  const employees = [
    { employeeNo: 'EM-00001', employeeName: 'Bambang Sudirman', positionId: mgrPos?.id, positionName: 'Manager', description: 'Penanggung jawab operasional cabang' },
    { employeeNo: 'EM-00002', employeeName: 'Rina Kartika', positionId: csrPos?.id, positionName: 'Cashier', description: 'Kasir utama toko' },
    { employeeNo: 'EM-00003', employeeName: 'Joko Widodo', positionId: spvPos?.id, positionName: 'Supervisor', description: 'Supervisor persediaan gudang' },
    { employeeNo: 'EM-00004', employeeName: 'Siti Aminah', positionId: stfPos?.id, positionName: 'Staff', description: 'Staf pelayanan customer' },
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

  const brandEris = await prisma.brand.upsert({ where: { brandCode: 'BRD-001' }, update: {}, create: { brandCode: 'BRD-001', brandName: 'ERIS' } });
  const brandArj = await prisma.brand.upsert({ where: { brandCode: 'BRD-002' }, update: {}, create: { brandCode: 'BRD-002', brandName: 'ARJ' } });
  const brandTefal = await prisma.brand.upsert({ where: { brandCode: 'BRD-003' }, update: {}, create: { brandCode: 'BRD-003', brandName: 'Tefal' } });

  const uomClient = (prisma as any).uoM || (prisma as any).uOM || (prisma as any).uom;
  const uomPcs = await uomClient.upsert({ where: { uomCode: 'UOM-001' }, update: {}, create: { uomCode: 'UOM-001', uomName: 'Pcs' } });
  const uomSet = await uomClient.upsert({ where: { uomCode: 'UOM-002' }, update: {}, create: { uomCode: 'UOM-002', uomName: 'Set' } });

  const inventories = [
    { barcode: '8801234000011', inventoryNo: 'INV-00001', inventoryName: 'ERIS Coffee Grinder Manual Kayu Premium', categoryId: catKopi.id, brandId: brandEris.id, uomId: uomPcs.id, hpp: 60000, price: 85000, stock: 24 },
    { barcode: '8801234000028', inventoryNo: 'INV-00002', inventoryName: 'OTC Coffee Grinder Manual Classic Stainless', categoryId: catKopi.id, brandId: brandEris.id, uomId: uomPcs.id, hpp: 55000, price: 80000, stock: 30 },
    { barcode: '8801234000059', inventoryNo: 'INV-00003', inventoryName: 'ARJ Mug Enamel Ayam Jago Tutup 9cm', categoryId: catEnamel.id, brandId: brandArj.id, uomId: uomPcs.id, hpp: 15000, price: 25000, stock: 50 },
    { barcode: '8801234000110', inventoryNo: 'INV-00004', inventoryName: 'Wok Pan Anti Lengket Tefal Coating 32cm', categoryId: catWajan.id, brandId: brandTefal.id, uomId: uomPcs.id, hpp: 180000, price: 245000, stock: 12 },
  ];

  for (const inv of inventories) {
    await prisma.inventory.upsert({
      where: { barcode: inv.barcode },
      update: inv,
      create: inv,
    });
  }

  // 7. Seed Promos
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

  // 8. Seed Memos
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

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
