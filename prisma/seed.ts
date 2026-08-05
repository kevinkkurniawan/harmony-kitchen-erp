import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MASSIVE (100+ Records per Table) Relational Data for Harmony Kitchen ERP...');

  // 1. Seed Positions & Employees (30 Employees)
  const positionDefs = [
    { positionNo: 'POS-001', positionName: 'Manager', description: 'Manager Operasional Cabang Toko' },
    { positionNo: 'POS-002', positionName: 'Supervisor', description: 'Supervisor Persediaan & Gudang' },
    { positionNo: 'POS-003', positionName: 'Cashier', description: 'Kasir Utama & Pembayaran' },
    { positionNo: 'POS-004', positionName: 'Chef / Dapur', description: 'Kepala Koki & Persediaan Dapur' },
    { positionNo: 'POS-005', positionName: 'Staff Gudang', description: 'Staf Logistik & Receiver' },
    { positionNo: 'POS-006', positionName: 'Staff Sales', description: 'Staf Penjualan & Pelayanan' },
  ];

  for (const pos of positionDefs) {
    await prisma.position.upsert({
      where: { positionNo: pos.positionNo },
      update: { positionName: pos.positionName, description: pos.description },
      create: pos,
    });
  }

  const positions = await prisma.position.findMany();

  const firstNames = ['Bambang', 'Rina', 'Joko', 'Siti', 'Hendra', 'Dewi', 'Agus', 'Budi', 'Rizal', 'Maya', 'Eko', 'Fitri', 'Doni', 'Lia', 'Linda', 'Sulis', 'Kevin', 'Hadi', 'Yulia', 'Teguh', 'Novi', 'Rudi', 'Dian', 'Aris', 'Wulan', 'Gita', 'Fajar', 'Titin', 'Bayu', 'Surya'];
  const lastNames = ['Sudirman', 'Kartika', 'Widodo', 'Aminah', 'Setiawan', 'Lestari', 'Pratama', 'Santoso', 'Hidayat', 'Kusuma', 'Purnomo', 'Wulandari', 'Saputra', 'Permata', 'Rahmawati', 'Suryani', 'Kurniawan', 'Wibowo', 'Anggraini', 'Suharto', 'Marlina', 'Firmansyah', 'Putri', 'Nugroho', 'Handayani', 'Utami', 'Ramadhan', 'Wijaya', 'Saputro', 'Utomo'];

  for (let i = 0; i < 30; i++) {
    const empNo = `EM-${(i + 1).toString().padStart(5, '0')}`;
    const empName = `${firstNames[i]} ${lastNames[i]}`;
    const pos = positions[i % positions.length];

    await prisma.employee.upsert({
      where: { employeeNo: empNo },
      update: { employeeName: empName, positionId: pos.id, positionName: pos.positionName },
      create: {
        employeeNo: empNo,
        employeeName: empName,
        positionId: pos.id,
        positionName: pos.positionName,
        description: `Karyawan aktif divisi ${pos.positionName}`,
        isActive: true,
      },
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
      await prisma.userModulePermission.upsert({
        where: { userId_moduleCode: { userId: createdUser.id, moduleCode: modCode } },
        update: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true },
        create: { userId: createdUser.id, moduleCode: modCode, canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true },
      });
    }
  }

  // 3. Seed Customers (30 Customers)
  const custTypes = ['Wholesale B2B', 'VIP Gold', 'Reguler', 'Corporate'];
  const cities = ['Surabaya', 'Sidoarjo', 'Gresik', 'Malang', 'Jakarta', 'Bandung', 'Semarang'];

  for (let i = 0; i < 30; i++) {
    const custCode = `C-${(i + 1).toString().padStart(5, '0')}`;
    const custName = `${firstNames[i]} (${i % 2 === 0 ? 'Toko/Resto' : 'Member'} ${lastNames[i]})`;
    const type = custTypes[i % custTypes.length];
    const city = cities[i % cities.length];
    const phone = `081${(10000000 + i * 12345).toString().slice(0, 8)}`;
    const limit = (i + 1) * 5000000;

    await prisma.customer.upsert({
      where: { customerCode: custCode },
      update: { customerName: custName, customerType: type, city, phone, creditLimit: limit },
      create: {
        customerCode: custCode,
        customerName: custName,
        customerType: type,
        address: `Jl. ${lastNames[i]} No. ${i + 10}`,
        city,
        phone,
        email: `cust${i + 1}@harmonykitchen.id`,
        contactPerson: firstNames[i],
        creditLimit: limit,
        isActive: true,
      },
    });
  }

  // 4. Seed Banks (10 Banks)
  const bankNames = ['Bank BCA', 'Bank Mandiri', 'Bank BRI', 'Bank BNI', 'Bank CIMB Niaga', 'Bank Danamon', 'Bank Permata', 'Bank OCBC NISP', 'Bank Panin', 'Bank Mega'];

  for (let i = 0; i < bankNames.length; i++) {
    const bankCode = `BANK-${(i + 1).toString().padStart(3, '0')}`;
    await prisma.bankAccount.upsert({
      where: { bankCode },
      update: { bankName: bankNames[i] },
      create: {
        bankCode,
        bankName: bankNames[i],
        accountNo: `${100 + i * 111}-${200 + i * 222}-${3000 + i * 100}`,
        accountHolder: 'PT Harmony Kitchenware',
        isActive: true,
      },
    });
  }

  // 5. Seed Suppliers (20 Suppliers)
  const suppTypes = ['Lokal Utama', 'Importir Resmi', 'Pengrajin Kayu', 'Distributor Elektronik'];
  for (let i = 0; i < 20; i++) {
    const suppCode = `SUP-${(i + 1).toString().padStart(4, '0')}`;
    const suppName = `PT/CV ${lastNames[i]} Kitchenware ${i + 1}`;
    const type = suppTypes[i % suppTypes.length];
    const city = cities[i % cities.length];
    const phone = `031-${7000000 + i * 1111}`;

    await prisma.supplier.upsert({
      where: { supplierCode: suppCode },
      update: { supplierName: suppName, supplierType: type, city, phone },
      create: {
        supplierCode: suppCode,
        supplierName: suppName,
        supplierType: type,
        address: `Kawasan Industri ${city} Blok ${String.fromCharCode(65 + (i % 6))}-${i + 1}`,
        city,
        phone,
        email: `supplier${i + 1}@manufacture.co.id`,
        contactPerson: firstNames[i],
        isActive: true,
      },
    });
  }

  // 6. Seed Categories, Brands, UoMs & Inventories (50 Kitchenware Products)
  const categories = [
    await prisma.category.upsert({ where: { categoryCode: 'CAT-001' }, update: {}, create: { categoryCode: 'CAT-001', categoryName: 'Peralatan Kopi' } }),
    await prisma.category.upsert({ where: { categoryCode: 'CAT-002' }, update: {}, create: { categoryCode: 'CAT-002', categoryName: 'Enamel & Cangkir' } }),
    await prisma.category.upsert({ where: { categoryCode: 'CAT-003' }, update: {}, create: { categoryCode: 'CAT-003', categoryName: 'Wajan & Panci' } }),
    await prisma.category.upsert({ where: { categoryCode: 'CAT-004' }, update: {}, create: { categoryCode: 'CAT-004', categoryName: 'Elektronik Dapur' } }),
    await prisma.category.upsert({ where: { categoryCode: 'CAT-005' }, update: {}, create: { categoryCode: 'CAT-005', categoryName: 'Utensil & Kayu' } }),
  ];

  const brands = [
    await prisma.brand.upsert({ where: { brandCode: 'BRD-001' }, update: {}, create: { brandCode: 'BRD-001', brandName: 'ERIS' } }),
    await prisma.brand.upsert({ where: { brandCode: 'BRD-002' }, update: {}, create: { brandCode: 'BRD-002', brandName: 'ARJ' } }),
    await prisma.brand.upsert({ where: { brandCode: 'BRD-003' }, update: {}, create: { brandCode: 'BRD-003', brandName: 'Tefal' } }),
    await prisma.brand.upsert({ where: { brandCode: 'BRD-004' }, update: {}, create: { brandCode: 'BRD-004', brandName: 'Philips' } }),
    await prisma.brand.upsert({ where: { brandCode: 'BRD-005' }, update: {}, create: { brandCode: 'BRD-005', brandName: 'ChefMaster' } }),
  ];

  const uomClient = (prisma as any).uoM || (prisma as any).uOM || (prisma as any).uom;
  const uomPcs = await uomClient.upsert({ where: { uomCode: 'UOM-001' }, update: {}, create: { uomCode: 'UOM-001', uomName: 'Pcs' } });
  const uomSet = await uomClient.upsert({ where: { uomCode: 'UOM-002' }, update: {}, create: { uomCode: 'UOM-002', uomName: 'Set' } });

  const productNames = [
    'Coffee Grinder Manual Kayu Premium', 'Coffee Grinder Manual Classic Stainless', 'Electric Coffee Grinder 200W', 'French Press Glass 600ml', 'Milk Frother Handheld Stainless',
    'Mug Enamel Ayam Jago Tutup 9cm', 'Cangkir Enamel Jago Polos 10cm', 'Teapot Enamel Ayam Jago 1.5L', 'Piring Enamel Saji Vintage 22cm', 'Mangkok Enamel Sup Ayam Jago 14cm',
    'Wok Pan Anti Lengket Tefal Coating 32cm', 'Panci Saucepan Stainless Steel 18cm', 'Fry Pan Ceramic Coating 24cm', 'Stock Pot Stainless Steel 12L', 'Panci Presto Pressure Cooker 8L',
    'Hand Mixer 300W 5 Speed Turbo', 'NutriMix Blender Kaca 2L', 'Food Processor 4 in 1 500W', 'Electric Kettle Cordless 1.7L', 'Air Fryer Touchscreen 4.5L',
    'Talenan Kayu Jati Premium 40x25cm', 'Set Pisau Dapur Stainless Steel 5 in 1', 'Thermos Vacuum Flask Stainless 2L', 'Toples Glass Canister Kedap Udara 1.5L', 'Spatula Kayu Teak Wood Set 4 Pcs',
    'Chef Knife 8 Inch Damaskus Steel', 'Santoku Knife 7 Inch Stainless', 'Utility Knife 5 Inch Stainless', 'Bread Knife Serrated 8 Inch', 'Paring Knife 3.5 Inch Stainless',
    'Pengocok Telur Whisker Stainless', 'Capitan Makanan Food Tongs 12 Inch', 'Sendok Sayur Soup Ladle Stainless', 'Saringan Minyak Mesh Strainer 18cm', 'Parutan Keju Cheese Grater Stainless',
    'Wok Pan Cast Iron Heavy Duty 30cm', 'Griddle Pan Square Non-Stick 28cm', 'Casserole Dish Enamel Cast Iron 24cm', 'Steamer Pot Stainless 3 Tier 28cm', 'Panci Milk Pan Stainless 14cm',
    'Coffee Dripper V60 Ceramic Size 02', 'Coffee Server Glass Pitcher 600ml', 'Coffee Kettle Gooseneck 1.2L', 'Digital Kitchen Scale Precision 5kg', 'Timer Masak Digital LCD Magnet',
    'Toples Bumbu Spice Jar Set 6 Pcs', 'Rak Bumbu Dapur Rotary Stainless', 'Wadah Botol Minyak Glass Dispenser 500ml', 'Tempat Pisau Magnetic Block Kayu', 'Talenan Plastik Anti Bakteri Set 3 Warna'
  ];

  for (let i = 0; i < productNames.length; i++) {
    const barcode = (8801234000000 + i + 11).toString();
    const invNo = `INV-${(i + 1).toString().padStart(5, '0')}`;
    const name = productNames[i];
    const cat = categories[i % categories.length];
    const brd = brands[i % brands.length];
    const hpp = (i + 1) * 15000 + 10000;
    const price = Math.round(hpp * 1.35);
    const stock = (i + 1) * 3 + 10;

    await prisma.inventory.upsert({
      where: { barcode },
      update: { inventoryName: name, hpp, price, stock },
      create: {
        barcode,
        inventoryNo: invNo,
        inventoryName: name,
        categoryId: cat.id,
        brandId: brd.id,
        uomId: i % 5 === 0 ? uomSet.id : uomPcs.id,
        hpp,
        price,
        stock,
        isActive: true,
      },
    });
  }

  const allInventories = await prisma.inventory.findMany();
  const allCustomers = await prisma.customer.findMany();
  const allSuppliers = await prisma.supplier.findMany();
  const allBanks = await prisma.bankAccount.findMany();
  const allEmps = await prisma.employee.findMany();

  // 7. Seed MASSIVE Sales POS & Laporan Penjualan (120 Transactions across dates)
  console.log('Seeding 120+ Sales POS Transactions...');
  const cashiers = ['Rina Kartika', 'Dewi Lestari', 'Lia Kasir Utama'];

  for (let i = 1; i <= 120; i++) {
    const invNo = `POS-202608-${i.toString().padStart(3, '0')}`;
    const daysAgo = i % 30;
    const txDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const cust = allCustomers[i % allCustomers.length];
    const cashier = cashiers[i % cashiers.length];

    // Pick 2-4 items per sales order
    const item1 = allInventories[i % allInventories.length];
    const item2 = allInventories[(i + 5) % allInventories.length];
    const qty1 = (i % 3) + 1;
    const qty2 = (i % 2) + 1;

    const subtotal1 = item1.price * qty1;
    const subtotal2 = item2.price * qty2;
    const totalAmount = subtotal1 + subtotal2;
    const discountAmount = i % 4 === 0 ? Math.round(totalAmount * 0.1) : 0;
    const grandTotal = totalAmount - discountAmount;

    const existing = await prisma.salesPOSHeader.findUnique({ where: { salesPOSNo: invNo } });
    if (!existing) {
      await prisma.salesPOSHeader.create({
        data: {
          salesPOSNo: invNo,
          salesPOSDate: txDate,
          customerName: cust.customerName,
          totalAmount,
          discountAmount,
          grandTotal,
          cashierName: cashier,
          status: 'COMPLETED',
          details: {
            create: [
              { barcode: item1.barcode, inventoryNo: item1.inventoryNo, inventoryName: item1.inventoryName, qty: qty1, price: item1.price, subtotal: subtotal1 },
              { barcode: item2.barcode, inventoryNo: item2.inventoryNo, inventoryName: item2.inventoryName, qty: qty2, price: item2.price, subtotal: subtotal2 },
            ],
          },
        },
      });
    }
  }

  // 8. Seed MASSIVE Stock Opname (50 Transactions across warehouses)
  console.log('Seeding 50 Stock Opname Records...');
  const warehouses = ['Gudang Utama Harmoni', 'Gudang Display Showroom', 'Bar Kopi Rungkut', 'Gudang Pastry', 'Gudang Elektronik'];

  for (let i = 1; i <= 50; i++) {
    const opnNo = `OPN-202608-${i.toString().padStart(3, '0')}`;
    const wh = warehouses[i % warehouses.length];
    const daysAgo = i % 25;
    const opnDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const inv = allInventories[i % allInventories.length];
    const sysQty = inv.stock;
    const diff = i % 5 === 0 ? -1 : (i % 7 === 0 ? 1 : 0);
    const physQty = Math.max(0, sysQty + diff);

    const existing = await prisma.opnameHeader.findUnique({ where: { opnameNo: opnNo } });
    if (!existing) {
      await prisma.opnameHeader.create({
        data: {
          opnameNo: opnNo,
          opnameDate: opnDate,
          whName: wh,
          details: {
            create: [
              { barcode: inv.barcode, inventoryNo: inv.inventoryNo, inventoryName: inv.inventoryName, systemQty: sysQty, physicalQty: physQty, diffQty: diff },
            ],
          },
        },
      });
    }
  }

  // 9. Seed MASSIVE Purchase Requests / PR (50 Records)
  console.log('Seeding 50 Purchase Request Records...');
  const statuses = ['Approved', 'Draft', 'Pending Approval', 'Processed to PO'];

  for (let i = 1; i <= 50; i++) {
    const prNo = `PR-202608-${i.toString().padStart(3, '0')}`;
    const inv = allInventories[i % allInventories.length];
    const status = statuses[i % statuses.length];

    const existing = await prisma.purchaseRequestHeader.findUnique({ where: { prNo } });
    if (!existing) {
      await prisma.purchaseRequestHeader.create({
        data: {
          prNo,
          prDate: new Date(Date.now() - (i % 20) * 24 * 60 * 60 * 1000),
          requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          description: `Pengajuan Pembelian Restock ${inv.inventoryName}`,
          status,
          details: {
            create: [
              { barcode: inv.barcode, inventoryNo: inv.inventoryNo, inventoryName: inv.inventoryName, qty: 10 + (i % 5) * 5, uomName: 'Pcs', notes: `Restock divisi ${i + 1}` },
            ],
          },
        },
      });
    }
  }

  // 10. Seed MASSIVE Purchase Orders / PO (50 Records with 11% PPN)
  console.log('Seeding 50 Purchase Order Records...');
  for (let i = 1; i <= 50; i++) {
    const poNo = `PO-202608-${i.toString().padStart(3, '0')}`;
    const supp = allSuppliers[i % allSuppliers.length];
    const inv = allInventories[i % allInventories.length];
    const qty = 10 + (i % 4) * 5;
    const subtotal = inv.hpp * qty;
    const tax = Math.round(subtotal * 0.11);
    const grandTotal = subtotal + tax;

    const existing = await prisma.purchaseOrderHeader.findUnique({ where: { poNo } });
    if (!existing) {
      await prisma.purchaseOrderHeader.create({
        data: {
          poNo,
          poDate: new Date(Date.now() - (i % 15) * 24 * 60 * 60 * 1000),
          supplierName: supp.supplierName,
          deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          description: `Order Pembelian Restock ${inv.inventoryName}`,
          subtotal,
          tax,
          grandTotal,
          status: 'Approved',
          details: {
            create: [
              { barcode: inv.barcode, inventoryNo: inv.inventoryNo, inventoryName: inv.inventoryName, qty, unitPrice: inv.hpp, subtotal },
            ],
          },
        },
      });
    }
  }

  // 11. Seed MASSIVE Material Receivement (MR Express & Priced - 50 Records)
  console.log('Seeding 50 Material Receivement Records...');
  for (let i = 1; i <= 25; i++) {
    const mrNoExp = `MR-EXP-202608-${i.toString().padStart(3, '0')}`;
    const mrNoPrc = `MR-PRC-202608-${i.toString().padStart(3, '0')}`;
    const supp = allSuppliers[i % allSuppliers.length];
    const inv = allInventories[i % allInventories.length];
    const qty = 10 + (i % 3) * 5;

    const existExp = await prisma.materialReceiveHeader.findUnique({ where: { mrNo: mrNoExp } });
    if (!existExp) {
      await prisma.materialReceiveHeader.create({
        data: {
          mrNo: mrNoExp,
          mrDate: new Date(Date.now() - (i % 10) * 24 * 60 * 60 * 1000),
          poNo: `PO-202608-${i.toString().padStart(3, '0')}`,
          supplierName: supp.supplierName,
          isPriced: false,
          details: {
            create: [{ barcode: inv.barcode, inventoryNo: inv.inventoryNo, inventoryName: inv.inventoryName, qty, unitPrice: 0, subtotal: 0 }],
          },
        },
      });
    }

    const existPrc = await prisma.materialReceiveHeader.findUnique({ where: { mrNo: mrNoPrc } });
    if (!existPrc) {
      await prisma.materialReceiveHeader.create({
        data: {
          mrNo: mrNoPrc,
          mrDate: new Date(Date.now() - (i % 10) * 24 * 60 * 60 * 1000),
          poNo: `PO-202608-${i.toString().padStart(3, '0')}`,
          supplierName: supp.supplierName,
          isPriced: true,
          details: {
            create: [{ barcode: inv.barcode, inventoryNo: inv.inventoryNo, inventoryName: inv.inventoryName, qty, unitPrice: inv.hpp, subtotal: inv.hpp * qty }],
          },
        },
      });
    }
  }

  // 12. Seed MASSIVE Purchase Payments (40 Records)
  console.log('Seeding 40 Purchase Payment Records...');
  for (let i = 1; i <= 40; i++) {
    const payNo = `PAY-202608-${i.toString().padStart(3, '0')}`;
    const supp = allSuppliers[i % allSuppliers.length];
    const bank = allBanks[i % allBanks.length];
    const amount = (i + 1) * 750000;

    const existing = await prisma.purchasePaymentHeader.findUnique({ where: { paymentNo: payNo } });
    if (!existing) {
      await prisma.purchasePaymentHeader.create({
        data: {
          paymentNo: payNo,
          paymentDate: new Date(Date.now() - (i % 12) * 24 * 60 * 60 * 1000),
          supplierName: supp.supplierName,
          bankName: bank.bankName,
          referenceNo: `TRX-${bank.bankName.slice(-3).toUpperCase()}-${100000 + i * 888}`,
          grandTotal: amount,
          details: {
            create: [{ invoiceNo: `INV-MR-PRC-202608-${i.toString().padStart(3, '0')}`, amountPaid: amount }],
          },
        },
      });
    }
  }

  // 13. Seed MASSIVE Purchase Returns (30 Records)
  console.log('Seeding 30 Purchase Return Records...');
  for (let i = 1; i <= 30; i++) {
    const retNo = `RET-202608-${i.toString().padStart(3, '0')}`;
    const supp = allSuppliers[i % allSuppliers.length];
    const inv = allInventories[i % allInventories.length];

    const existing = await prisma.purchaseReturnHeader.findUnique({ where: { returnNo: retNo } });
    if (!existing) {
      await prisma.purchaseReturnHeader.create({
        data: {
          returnNo: retNo,
          returnDate: new Date(Date.now() - (i % 8) * 24 * 60 * 60 * 1000),
          mrNo: `MR-EXP-202608-${(i % 25 + 1).toString().padStart(3, '0')}`,
          supplierName: supp.supplierName,
          returnReason: i % 2 === 0 ? 'Dus kemasan penyok saat ekspedisi' : 'Cacat fisik awal dari manufaktur',
          details: {
            create: [{ barcode: inv.barcode, inventoryNo: inv.inventoryNo, inventoryName: inv.inventoryName, qty: (i % 3) + 1 }],
          },
        },
      });
    }
  }

  // 14. Seed MASSIVE Pemakaian Barang Internal (40 Records)
  console.log('Seeding 40 Inventory Usage Records...');
  for (let i = 1; i <= 40; i++) {
    const usgNo = `USG-202608-${i.toString().padStart(3, '0')}`;
    const inv = allInventories[i % allInventories.length];

    const existing = await prisma.inventoryUsageHeader.findUnique({ where: { usageNo: usgNo } });
    if (!existing) {
      await prisma.inventoryUsageHeader.create({
        data: {
          usageNo: usgNo,
          usageDate: new Date(Date.now() - (i % 14) * 24 * 60 * 60 * 1000),
          whName: warehouses[i % warehouses.length],
          description: `Pemakaian operasional ${inv.inventoryName}`,
          details: {
            create: [{ barcode: inv.barcode, inventoryNo: inv.inventoryNo, inventoryName: inv.inventoryName, qty: (i % 4) + 1, uomName: 'Pcs', notes: `Divisi ${i + 1}` }],
          },
        },
      });
    }
  }

  // 15. Seed MASSIVE Promos & Memos (20 Records each)
  console.log('Seeding 20 Promos and 20 Memos...');
  const promoGrp = await prisma.promoGroup.upsert({
    where: { id: 1 },
    update: { groupName: 'Promo Peralatan Dapur Utama' },
    create: { groupName: 'Promo Peralatan Dapur Utama' },
  });

  for (let i = 1; i <= 20; i++) {
    const pNo = `PRM-2026-${i.toString().padStart(3, '0')}`;
    await prisma.promo.upsert({
      where: { promoNo: pNo },
      update: { promoName: `Promo Diskon Spesial ${i * 5}%`, discountPct: (i % 4 + 1) * 5 },
      create: {
        promoNo: pNo,
        promoName: `Promo Diskon Spesial ${i * 5}%`,
        groupId: promoGrp.id,
        discountPct: (i % 4 + 1) * 5,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    const mNo = `MEM-${i.toString().padStart(3, '0')}`;
    await prisma.memo.upsert({
      where: { memoNo: mNo },
      update: { title: `Pemberitahuan Operasional Cabang Ke-${i}` },
      create: {
        memoNo: mNo,
        title: `Pemberitahuan Operasional Cabang Ke-${i}`,
        content: `Instruksi kerja dan panduan operasional standar tim divisi ke-${i}.`,
        author: i % 2 === 0 ? 'Manager Operasional' : 'Supervisor Gudang',
        status: 'OPEN',
      },
    });
  }

  console.log('MASSIVE (100+ Records per Table) Relational Data Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
