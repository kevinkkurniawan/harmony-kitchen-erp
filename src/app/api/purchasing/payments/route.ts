import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = q ? {
      OR: [
        { ppno: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {};

    const [total, payments] = await Promise.all([
      prisma.t_purchasepaymentheader.count({ where }),
      prisma.t_purchasepaymentheader.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const supplierIds = Array.from(new Set(payments.map(p => p.supplierid).filter(Boolean)));
    const suppliers = await prisma.supplier.findMany({ where: { id: { in: supplierIds } } });
    const supplierMap = new Map(suppliers.map(s => [s.id, s.suppliername]));

    const ppids = payments.map(p => p.id);
    const allDetails = await prisma.t_purchasepaymentdetail.findMany({
      where: { ppid: { in: ppids } }
    });

    const mapped = payments.map((p: any) => {
      const details = allDetails.filter(d => d.ppid === p.id);
      return {
        id: p.id,
        payment_no: p.ppno,
        payment_date: p.ppdate,
        supplier_name: supplierMap.get(p.supplierid) || 'Unknown',
        bank_name: '-', // Not mapped directly in header
        reference_no: '-',
        grand_total: p.grandtotal,
        created_at: p.createddate,
        items: details.map((d: any) => ({
          id: d.id,
          invoice_no: d.mrno || '-',
          amount_paid: Number(d.payment || 0),
        })),
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payment_no, payment_date, supplier_name, bank_name, reference_no, grand_total, items } = body;

    const supplier = await prisma.supplier.findFirst({ where: { suppliername: supplier_name } });
    const supplierid = supplier ? supplier.id : 1;

    const header = await prisma.t_purchasepaymentheader.create({
      data: {
        ppno: payment_no,
        ppdate: payment_date ? new Date(payment_date) : new Date(),
        supplierid,
        grandtotal: Number(grand_total || 0),
        description: reference_no || '',
        createduser: 'system',
        createddate: new Date(),
        modifieduser: 'system',
        modifieddate: new Date(),
      }
    });

    if (items && Array.isArray(items)) {
      await prisma.t_purchasepaymentdetail.createMany({
        data: items.map((it: any) => ({
          ppid: header.id,
          mrid: 0, // Fallback since MR isn't fully resolved
          mrno: it.invoice_no || it.inventoryNo || it.invoiceNo || '-',
          balance: 0,
          payment: Number(it.amount_paid || it.amountPaid || 0),
          createduser: 'system',
          createddate: new Date(),
          modifieduser: 'system',
          modifieddate: new Date(),
        }))
      });
    }

    return NextResponse.json({ success: true, message: 'Pembayaran Supplier berhasil disimpan', data: header });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, payment_no, payment_date, supplier_name, bank_name, reference_no, grand_total, items } = body;

    const supplier = await prisma.supplier.findFirst({ where: { suppliername: supplier_name } });
    const supplierid = supplier ? supplier.id : 1;

    const updated = await prisma.t_purchasepaymentheader.update({
      where: { ppno_supplierid: { ppno: payment_no, supplierid } },
      data: {
        ppdate: payment_date ? new Date(payment_date) : undefined,
        grandtotal: Number(grand_total || 0),
        description: reference_no || '',
      }
    });

    await prisma.t_purchasepaymentdetail.deleteMany({ where: { ppid: updated.id } });
    if (items && Array.isArray(items)) {
      await prisma.t_purchasepaymentdetail.createMany({
        data: items.map((it: any) => ({
          ppid: updated.id,
          mrid: 0,
          mrno: it.invoice_no || it.inventoryNo || it.invoiceNo || '-',
          balance: 0,
          payment: Number(it.amount_paid || it.amountPaid || 0),
          createduser: 'system',
          createddate: new Date(),
          modifieduser: 'system',
          modifieddate: new Date(),
        }))
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    await prisma.t_purchasepaymentdetail.deleteMany({ where: { ppid: id } });
    // Since we don't know supplierid, we can just delete it if id is unique but it's not the PK.
    // We can query the header to find ppno and supplierid
    const header = await prisma.t_purchasepaymentheader.findFirst({ where: { id } });
    if (header) {
      await prisma.t_purchasepaymentheader.delete({ where: { ppno_supplierid: { ppno: header.ppno, supplierid: header.supplierid } } });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
