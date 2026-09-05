import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const noTx = searchParams.get('noTx');
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    if (noTx) {
      const details = await prisma.t_opname.findMany({
        where: { notransaction: noTx },
      });

      if (!details || details.length === 0) {
        return NextResponse.json({ success: false, error: 'Opname tidak ditemukan' }, { status: 404 });
      }

      const inventoryIds = details.map((d: any) => d.inventoryid).filter(Boolean);
      const inventories = await prisma.inventory.findMany({
        where: { id: { in: inventoryIds } },
        select: { id: true, barcode: true, inventoryno: true, inventoryname: true, price: true, stokupdate: true },
      });

      const invMap = new Map(inventories.map((inv: any) => [inv.id, inv]));

      const items = details.map((d: any) => {
        const matched = invMap.get(d.inventoryid);
        const sysQty = matched?.stokupdate || 0;
        const physQty = Number(d.qty || 0);
        const diffQty = physQty - sysQty;

        return {
          id: String(d.id),
          inventoryId: d.inventoryid,
          barcode: matched?.barcode || d.barcode || '',
          inventoryNo: matched?.inventoryno || '',
          inventory_no: matched?.inventoryno || '',
          inventoryName: matched?.inventoryname || '',
          inventory_name: matched?.inventoryname || '',
          systemQty: sysQty,
          system_qty: sysQty,
          physicalQty: physQty,
          physical_qty: physQty,
          diffQty: diffQty,
          diff_qty: diffQty,
          qty: physQty,
          price: matched?.price || d.price || 0,
          description: diffQty === 0 ? 'Sesuai (Klop)' : diffQty > 0 ? `Surplus (+${diffQty})` : `Defisit (${diffQty})`,
        };
      });

      return NextResponse.json({
        success: true,
        data: items,
        header: {
          noTransaction: noTx,
          no_tx: noTx,
          opnameNo: noTx,
          date: details[0].opnamedate || details[0].createddate,
          whName: 'Gudang Utama',
          items,
        },
      });
    }

    const where = q
      ? { notransaction: { contains: q, mode: 'insensitive' as const } }
      : undefined;

    // We must group by notransaction to get headers
    const groups = await prisma.t_opname.groupBy({
      by: ['notransaction', 'opnamedate', 'createddate'],
      where,
      _count: { inventoryid: true },
      orderBy: { createddate: 'desc' },
      skip: paginationParams.skip,
      take: paginationParams.limit,
    });
    
    // For total count of unique opnames
    const totalGroups = await prisma.t_opname.groupBy({
      by: ['notransaction'],
      where,
    });
    const total = totalGroups.length;

    const mapped = groups.map((g: any, i: number) => ({
      id: String(i),
      noTransaction: g.notransaction,
      opname_no: g.notransaction,
      opnameNo: g.notransaction,
      opnameDate: g.opnamedate || g.createddate,
      opname_date: g.opnamedate || g.createddate,
      whName: 'Gudang Utama',
      wh_name: 'Gudang Utama',
      totalItems: g._count.inventoryid,
      total_items: g._count.inventoryid,
      created_at: g.createddate,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let no_tx = body.no_tx || body.noTransaction || body.opnameNo;
    const date = body.date || body.opnameDate;
    let items = body.items;

    // Support single-item payload
    if (!items && body.inventoryId !== undefined) {
      const inv = await prisma.inventory.findUnique({ where: { id: Number(body.inventoryId) } });
      if (inv) {
        no_tx = no_tx || `OPN-SINGLE-${Date.now()}`;
        const physQty = Number(body.qtyOpname ?? body.qty ?? body.physicalQty ?? inv.stokupdate);
        items = [{
          inventoryId: inv.id,
          barcode: inv.barcode || '',
          qty: physQty,
        }];
      }
    }

    if (!no_tx || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Opname dan detail barang wajib diisi' }, { status: 400 });
    }

    // Resolve inventory IDs for items that might only have barcodes or inventory_no
    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i.id]));

    const result = await prisma.$transaction(async (tx) => {
      await tx.t_opname.deleteMany({
        where: { notransaction: no_tx },
      });
      
      const toCreate = items.map((it: any) => {
        const physQty = Number(it.qty ?? it.physicalQty ?? it.physical_qty ?? 0);
        return {
          notransaction: no_tx,
          inventoryid: Number(it.inventoryId || invMapByNo.get(it.inventoryNo || it.inventory_no) || 1),
          barcode: it.barcode || '',
          qty: physQty,
          price: 0,
          description: '',
          opnamedate: date ? new Date(date) : new Date(),
          createduser: 'system',
          createddate: new Date(),
          modifieduser: 'system',
          modifieddate: new Date(),
        };
      });

      await tx.t_opname.createMany({ data: toCreate });

      // Adjust stock
      for (const it of toCreate) {
        if (it.inventoryid) {
          await tx.inventory.updateMany({
            where: { id: it.inventoryid },
            data: { stokupdate: it.qty },
          });
        }
      }
      return toCreate;
    }, { maxWait: 15000, timeout: 60000 });

    return NextResponse.json({
      success: true,
      message: 'Stock Opname berhasil disimpan & stok inventori telah diperbarui',
      data: result,
    });
  } catch (error: any) {
    console.error('Error in POST /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
