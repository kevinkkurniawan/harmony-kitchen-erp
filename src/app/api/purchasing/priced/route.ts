import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});
posPool.on('connect', client => client.query('SET search_path TO pos, public;'));

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where = {
      isPriced: true,
      ...(q
        ? {
            OR: [
              { mrNo: { contains: q, mode: 'insensitive' as const } },
              { supplierName: { contains: q, mode: 'insensitive' as const } },
              { poNo: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, receives] = await Promise.all([
      prisma.materialReceiveHeader.count({ where }),
      prisma.materialReceiveHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = receives.map((mr) => {
      const totalQty = mr.details.reduce((sum, d) => sum + Number(d.qty), 0);
      const totalAmount = mr.details.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);
      const formattedDate = mr.mrDate ? new Date(mr.mrDate).toLocaleDateString('id-ID') : '-';

      return {
        id: mr.id,
        mrNo: mr.mrNo,
        mr_no: mr.mrNo,
        mrDate: formattedDate,
        mr_date: formattedDate,
        poNo: mr.poNo || '-',
        po_no: mr.poNo || '-',
        doNo: mr.doNo || '-',
        supplierId: mr.supplierId,
        supplierName: mr.supplierName,
        supplier_name: mr.supplierName,
        driverName: mr.driverName || '-',
        vehicleNo: mr.vehicleNo || '-',
        whName: mr.whName || 'Gudang Utama',
        description: mr.description || '-',
        isExpress: mr.isExpress,
        isVoid: mr.isVoid,
        totalQty: totalQty,
        total_qty: totalQty,
        totalAmount: (mr.grandTotal && mr.grandTotal > 0) ? mr.grandTotal : totalAmount,
        total_amount: (mr.grandTotal && mr.grandTotal > 0) ? mr.grandTotal : totalAmount,
        paymentType: mr.paymentType || '-',
        dueDate: mr.dueDate ? new Date(mr.dueDate).toLocaleDateString('id-ID') : '-',
        downPayment: mr.downPayment || 0,
        discPercentage: mr.discPercentage || 0,
        ppnPercentage: mr.ppnPercentage || 0,
        subtotal: mr.subtotal || totalAmount,
        tax: mr.tax || 0,
        grandTotal: (mr.grandTotal && mr.grandTotal > 0) ? mr.grandTotal : totalAmount,
        grand_total: (mr.grandTotal && mr.grandTotal > 0) ? mr.grandTotal : totalAmount,
        items: mr.details.map((d) => ({
          id: d.id,
          inventoryId: d.inventoryId,
          barcode: d.barcode,
          inventoryNo: d.inventoryNo,
          inventory_no: d.inventoryNo,
          inventoryName: d.inventoryName,
          inventory_name: d.inventoryName,
          uomName: d.uomName || 'PCS',
          qty: d.qty,
          unitPrice: d.unitPrice,
          unit_price: d.unitPrice,
          subtotal: d.subtotal,
          description: d.description || '',
        })),
        createdAt: mr.createdAt,
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/priced:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mrNo = body.mrNo || body.mr_no;
    const mrDate = body.mrDate || body.mr_date;
    const supplierId = body.supplierId;
    const supplierName = body.supplierName || body.supplier_name;
    const poNo = body.poNo || body.po_no;
    const doNo = body.doNo;
    const driverName = body.driverName;
    const vehicleNo = body.vehicleNo;
    const whName = body.whName || 'Gudang Utama Dapur';
    const description = body.description;
    const isExpress = body.isExpress ?? false;
    const isVoid = body.isVoid ?? false;
    const items = body.items;

    const paymentType = body.paymentType;
    const dueDate = body.dueDate;
    const downPayment = Number(body.downPayment || 0);
    const discPercentage = Number(body.discPercentage || 0);
    const ppnPercentage = Number(body.ppnPercentage || 0);

    if (!mrNo || !supplierName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. MR, Supplier, dan detail item barang wajib diisi' }, { status: 400 });
    }

    const calculatedSubtotal = items.reduce((sum: number, it: any) => sum + Number(it.subtotal || (Number(it.qty || 0) * Number(it.price || it.unitPrice || it.unit_price || 0) * (1 - Number(it.discPercentage || 0) / 100))), 0);
    const calculatedDiscValue = calculatedSubtotal * (discPercentage / 100);
    const afterDiscSubtotal = calculatedSubtotal - calculatedDiscValue;
    const calculatedTax = afterDiscSubtotal * (ppnPercentage / 100);
    const calculatedGrandTotal = afterDiscSubtotal + calculatedTax;

    const created = await prisma.materialReceiveHeader.create({
      data: {
        mrNo: mrNo,
        mrDate: mrDate ? new Date(mrDate) : new Date(),
        poNo: poNo || null,
        doNo: doNo || null,
        supplierId: supplierId ? Number(supplierId) : null,
        supplierName: supplierName,
        driverName: driverName || null,
        vehicleNo: vehicleNo || null,
        whName: whName,
        description: description || null,
        isExpress: Boolean(isExpress),
        isVoid: Boolean(isVoid),
        isPriced: true,
        paymentType: paymentType || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        downPayment,
        discPercentage,
        ppnPercentage,
        subtotal: calculatedSubtotal,
        tax: calculatedTax,
        grandTotal: calculatedGrandTotal,
        details: {
          create: items.map((it: any) => {
            const qty = Number(it.qty || 0);
            const unitPrice = Number(it.price || it.unitPrice || it.unit_price || 0);
            const discPercentage = Number(it.discPercentage || 0);
            const subtotal = Number(it.subtotal || (qty * unitPrice * (1 - discPercentage / 100)));
            return {
              inventoryId: it.inventoryId ? Number(it.inventoryId) : null,
              barcode: it.barcode || '',
              inventoryNo: it.inventoryNo || it.inventory_no || '',
              inventoryName: it.inventoryName || it.inventory_name || '',
              uomName: it.uomName || 'PCS',
              qty: qty,
              unitPrice: unitPrice,
              subtotal: subtotal,
              description: it.description || null,
            };
          }),
        },
      },
      include: { details: true },
    });

    const grandTotal = created.grandTotal ?? created.details.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);

    // Update HPP and increment stock in PostgreSQL
    for (const it of items) {
      const invId = it.inventoryId ? Number(it.inventoryId) : undefined;
      const qty = Number(it.qty || 0);
      const unitPrice = Number(it.price || it.unitPrice || it.unit_price || 0);
      let updatedBarcode = it.barcode;

      if (invId) {
        const inv = await prisma.inventory.update({
          where: { id: invId },
          data: {
            hpp: unitPrice > 0 ? unitPrice : undefined,
            stock: { increment: qty },
          },
        }).catch(async () => {
          if (it.barcode) {
            return await prisma.inventory.update({
              where: { barcode: it.barcode },
              data: {
                hpp: unitPrice > 0 ? unitPrice : undefined,
                stock: { increment: qty },
              },
            }).catch(() => null);
          }
          return null;
        });
        
        if (inv && inv.barcode) {
          updatedBarcode = inv.barcode;
        }
      } else if (it.barcode) {
        await prisma.inventory.updateMany({
          where: { barcode: it.barcode },
          data: {
            hpp: unitPrice > 0 ? unitPrice : undefined,
            stock: { increment: qty },
          },
        }).catch(() => {});
      }
      
      // POS SYNC
      if (updatedBarcode) {
        try {
          await posPool.query(
            `UPDATE "Product" SET stock = stock + $1, "updatedAt" = NOW() WHERE barcode = $2`,
            [qty, updatedBarcode]
          );
        } catch (posErr) {
          console.error('POS Sync Error on Priced Receive:', posErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Penerimaan Barang dengan Harga berhasil disimpan & stok inventori serta HPP telah diperbarui',
      id: created.id,
      mrNo: created.mrNo,
      grandTotal: grandTotal,
      data: created,
    });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/priced:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
