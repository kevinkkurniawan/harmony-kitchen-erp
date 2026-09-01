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
  const catElektronik = await prisma.category.upsert({ where: { categoryCode: 'CAT-004' }, update: {}, create: { categoryCode: 'CAT-004', categoryName: 'Elektronik Dapur' } });
  const catUtensil = await prisma.category.upsert({ where: { categoryCode: 'CAT-005' }, update: {}, create: { categoryCode: 'CAT-005', categoryName: 'Utensil & Kayu' } });
  const catPisau = await prisma.category.upsert({ where: { categoryCode: 'CAT-006' }, update: {}, create: { categoryCode: 'CAT-006', categoryName: 'Pisau & Cutlery' } });
  const catToples = await prisma.category.upsert({ where: { categoryCode: 'CAT-007' }, update: {}, create: { categoryCode: 'CAT-007', categoryName: 'Toples & Botol Kaca' } });
  const catStainless = await prisma.category.upsert({ where: { categoryCode: 'CAT-008' }, update: {}, create: { categoryCode: 'CAT-008', categoryName: 'Perabot Stainless' } });

  const categoriesList = [catKopi, catEnamel, catWajan, catElektronik, catUtensil, catPisau, catToples, catStainless];

  const brandEris = await prisma.brand.upsert({ where: { brandCode: 'BRD-001' }, update: {}, create: { brandCode: 'BRD-001', brandName: 'ERIS' } });
  const brandArj = await prisma.brand.upsert({ where: { brandCode: 'BRD-002' }, update: {}, create: { brandCode: 'BRD-002', brandName: 'ARJ' } });
  const brandTefal = await prisma.brand.upsert({ where: { brandCode: 'BRD-003' }, update: {}, create: { brandCode: 'BRD-003', brandName: 'Tefal' } });
  const brandPhilips = await prisma.brand.upsert({ where: { brandCode: 'BRD-004' }, update: {}, create: { brandCode: 'BRD-004', brandName: 'Philips' } });
  const brandMaspion = await prisma.brand.upsert({ where: { brandCode: 'BRD-005' }, update: {}, create: { brandCode: 'BRD-005', brandName: 'Maspion' } });
  const brandOxone = await prisma.brand.upsert({ where: { brandCode: 'BRD-006' }, update: {}, create: { brandCode: 'BRD-006', brandName: 'Oxone' } });
  const brandChefMaster = await prisma.brand.upsert({ where: { brandCode: 'BRD-007' }, update: {}, create: { brandCode: 'BRD-007', brandName: 'ChefMaster' } });
  const brandSubron = await prisma.brand.upsert({ where: { brandCode: 'BRD-008' }, update: {}, create: { brandCode: 'BRD-008', brandName: 'Subron' } });

  const brandsList = [brandEris, brandArj, brandTefal, brandPhilips, brandMaspion, brandOxone, brandChefMaster, brandSubron];

  const uomClient = (prisma as any).uoM || (prisma as any).uOM || (prisma as any).uom;
  const uomPcs = await uomClient.upsert({ where: { uomCode: 'UOM-001' }, update: {}, create: { uomCode: 'UOM-001', uomName: 'Pcs' } });
  const uomSet = await uomClient.upsert({ where: { uomCode: 'UOM-002' }, update: {}, create: { uomCode: 'UOM-002', uomName: 'Set' } });
  const uomBox = await uomClient.upsert({ where: { uomCode: 'UOM-003' }, update: {}, create: { uomCode: 'UOM-003', uomName: 'Box' } });
  const uomDozen = await uomClient.upsert({ where: { uomCode: 'UOM-004' }, update: {}, create: { uomCode: 'UOM-004', uomName: 'Lusin' } });

  const uomsList = [uomPcs, uomSet, uomBox, uomDozen];

  // Base Products template
  const productTemplates = [
    { name: 'Coffee Grinder Manual Kayu Premium', price: 85000, hpp: 60000, cat: catKopi, brand: brandEris, uom: uomPcs },
    { name: 'Coffee Grinder Manual Classic Stainless', price: 80000, hpp: 55000, cat: catKopi, brand: brandEris, uom: uomPcs },
    { name: 'Mug Enamel Ayam Jago Tutup 9cm', price: 25000, hpp: 15000, cat: catEnamel, brand: brandArj, uom: uomPcs },
    { name: 'Wok Pan Anti Lengket Tefal Coating 32cm', price: 245000, hpp: 180000, cat: catWajan, brand: brandTefal, uom: uomPcs },
    { name: 'Mixer Tangan Elektrik Philips 5 Kecepatan 300W', price: 385000, hpp: 290000, cat: catElektronik, brand: brandPhilips, uom: uomPcs },
    { name: 'Teapot Stainless Steel Harmony 1.5L', price: 115000, hpp: 78000, cat: catStainless, brand: brandSubron, uom: uomPcs },
    { name: 'Talenan Kayu Jati Solid Anti Jamur 30x20cm', price: 65000, hpp: 42000, cat: catUtensil, brand: brandChefMaster, uom: uomPcs },
    { name: 'Pisau Dapur Chef Knife Stainless 8 Inch', price: 95000, hpp: 62000, cat: catPisau, brand: brandOxone, uom: uomPcs },
    { name: 'Set Pisau Dapur Blok Kayu 5 in 1', price: 275000, hpp: 195000, cat: catPisau, brand: brandOxone, uom: uomSet },
    { name: 'Toples Bumbu Glass Airtight Jar 500ml', price: 32000, hpp: 19000, cat: catToples, brand: brandSubron, uom: uomPcs },
    { name: 'Panci Stew Pot Stainless Steel Heavy Duty 24cm', price: 320000, hpp: 235000, cat: catStainless, brand: brandMaspion, uom: uomPcs },
    { name: 'Wajan Frypan Teflon Non-Stick 20cm', price: 75000, hpp: 48000, cat: catWajan, brand: brandMaspion, uom: uomPcs },
    { name: 'Cangkir Enamel Jago Polos Vintage 10cm', price: 18000, hpp: 10000, cat: catEnamel, brand: brandArj, uom: uomPcs },
    { name: 'French Press Coffee Maker 600ml Borosilicate', price: 125000, hpp: 85000, cat: catKopi, brand: brandEris, uom: uomPcs },
    { name: 'Blender Dapur Kaca Philips 2L 450W', price: 540000, hpp: 420000, cat: catElektronik, brand: brandPhilips, uom: uomPcs },
    { name: 'Spatula Silikon Tahan Panas 31cm Set 3 Pcs', price: 48000, hpp: 29000, cat: catUtensil, brand: brandChefMaster, uom: uomSet },
  ];

  // Generate 150 items
  const generatedInventories = [];
  for (let i = 1; i <= 150; i++) {
    const tmpl = productTemplates[(i - 1) % productTemplates.length];
    const cat = categoriesList[(i - 1) % categoriesList.length];
    const brand = brandsList[(i - 1) % brandsList.length];
    const uom = uomsList[(i - 1) % uomsList.length];

    const skuNum = String(i).padStart(5, '0');
    const barcodeNum = `8801234${skuNum}`;
    const variantSuffix = Math.floor(i / 16) > 0 ? ` (Varian ${Math.floor(i / 16) + 1})` : '';

    generatedInventories.push({
      barcode: barcodeNum,
      inventoryNo: `INV-${skuNum}`,
      inventoryName: `${brand.brandName} ${tmpl.name}${variantSuffix}`,
      categoryId: cat.id,
      brandId: brand.id,
      uomId: uom.id,
      hpp: tmpl.hpp + ((i % 10) * 2000),
      price: tmpl.price + ((i % 10) * 3500),
      stock: 10 + ((i * 7) % 180),
    });
  }

  for (const inv of generatedInventories) {
    const existingByBarcode = await prisma.inventory.findUnique({ where: { barcode: inv.barcode } });
    if (existingByBarcode) {
      await prisma.inventory.update({
        where: { id: existingByBarcode.id },
        data: {
          inventoryName: inv.inventoryName,
          hpp: inv.hpp,
          price: inv.price,
          stock: inv.stock,
        },
      });
    } else {
      const existingByNo = await prisma.inventory.findUnique({ where: { inventoryNo: inv.inventoryNo } });
      const inventoryNoToUse = existingByNo ? `INV-${Date.now()}-${Math.floor(Math.random()*1000)}` : inv.inventoryNo;
      await prisma.inventory.create({
        data: {
          ...inv,
          inventoryNo: inventoryNoToUse,
        },
      });
    }
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

  // 9. Seed Rich Opname Transactions (20 Transactions with full items)
  const allInventories = await prisma.inventory.findMany();
  if (allInventories.length > 0) {
    const opnameWarehouses = [
      'Gudang Utama Harmoni',
      'Gudang Display Showroom',
      'Bar Kopi Rungkut',
      'Gudang Pastry',
      'Gudang Elektronik',
    ];

    for (let i = 1; i <= 20; i++) {
      const padNum = String(i).padStart(3, '0');
      const opnameNo = `OPN-202609-${padNum}`;
      const whName = opnameWarehouses[(i - 1) % opnameWarehouses.length];

      const existingOp = await prisma.opnameHeader.findUnique({ where: { opnameNo } });
      if (!existingOp) {
        await prisma.opnameHeader.create({
          data: {
            opnameNo,
            opnameDate: new Date(Date.now() - (20 - i) * 12 * 60 * 60 * 1000),
            whName,
            details: {
              create: allInventories.map((inv, idx) => {
                // Vary variances realistically (some match 0, some +surplus, some -deficit)
                const variancePattern = ((idx + i) % 5 === 0) ? -3 : ((idx + i) % 4 === 0) ? 2 : ((idx + i) % 3 === 0) ? -1 : 0;
                const sysQty = inv.stock || 20;
                const physQty = Math.max(0, sysQty + variancePattern);
                return {
                  barcode: inv.barcode,
                  inventoryNo: inv.inventoryNo,
                  inventoryName: inv.inventoryName,
                  systemQty: sysQty,
                  physicalQty: physQty,
                  diffQty: physQty - sysQty,
                };
              }),
            },
          },
        });
      }
    }
  }

  // 10. Seed Rich Sales POS Transactions (30 Transactions with realistic details & dates)
  if (allInventories.length > 0) {
    const customerNames = [
      'Pelanggan Umum POS',
      'Budi Santoso (Resto Bintang)',
      'Siti Rahma (VIP Gold)',
      'Toko Kopi Jaya Abadi',
      'Catering Berkah Utama',
      'Warung Makan Pak Slamet',
    ];
    const cashierNames = ['Rina Kartika (Kasir 1)', 'Siti Aminah (Kasir 2)', 'Bambang (Admin POS)'];

    for (let i = 1; i <= 30; i++) {
      const padNum = String(i).padStart(4, '0');
      const salesPOSNo = `POS-202609-${padNum}`;
      const customerName = customerNames[(i - 1) % customerNames.length];
      const cashierName = cashierNames[(i - 1) % cashierNames.length];

      // Spread dates across last 60 days
      const txDate = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000);

      // Select 2 to 5 random items
      const selectedItems = [];
      let totalAmount = 0;
      const itemCount = (i % 4) + 2;

      for (let j = 0; j < itemCount; j++) {
        const inv = allInventories[(i * 3 + j) % allInventories.length];
        const qty = (j % 3) + 1;
        const price = inv.price || 50000;
        const subtotal = qty * price;
        totalAmount += subtotal;

        selectedItems.push({
          barcode: inv.barcode,
          inventoryNo: inv.inventoryNo,
          inventoryName: inv.inventoryName,
          qty,
          price,
          subtotal,
        });
      }

      const discountAmount = i % 3 === 0 ? Math.round(totalAmount * 0.05) : 0;
      const grandTotal = totalAmount - discountAmount;

      const existingSales = await prisma.salesPOSHeader.findUnique({ where: { salesPOSNo } });
      if (!existingSales) {
        await prisma.salesPOSHeader.create({
          data: {
            salesPOSNo,
            salesPOSDate: txDate,
            customerName,
            totalAmount,
            discountAmount,
            grandTotal,
            cashierName,
            status: 'COMPLETED',
            createdAt: txDate,
            details: {
              create: selectedItems,
            },
          },
        });
      }
    }
  }

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
