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
        { paymentNo: { contains: q, mode: 'insensitive' as const } },
        { supplierName: { contains: q, mode: 'insensitive' as const } },
        { referenceNo: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {};

    const [total, payments] = await Promise.all([
      prisma.purchasePaymentHeader.count({ where }),
      prisma.purchasePaymentHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = payments.map((p: any) => ({
      id: p.id,
      payment_no: p.paymentNo,
      payment_date: p.paymentDate,
      supplier_name: p.supplierName,
      bank_name: p.bankName,
      reference_no: p.referenceNo || '-',
      grand_total: p.grandTotal,
      created_at: p.createdAt,
      items: p.details.map((d: any) => ({
        id: d.id,
        invoice_no: d.invoiceNo || '-',
        amount_paid: Number(d.amountPaid || 0),
      })),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payment_no, payment_date, supplier_name, bank_name, reference_no, grand_total, items } = body;

    const header = await prisma.purchasePaymentHeader.create({
      data: {
        paymentNo: payment_no,
        paymentDate: payment_date ? new Date(payment_date) : new Date(),
        supplierName: supplier_name || 'Umum',
        bankName: bank_name || 'BCA',
        referenceNo: reference_no || '',
        grandTotal: Number(grand_total || 0),
        details: {
          create: (items || []).map((it: any) => ({
            invoiceNo: it.invoice_no || it.inventoryNo || it.invoiceNo || '-',
            amountPaid: Number(it.amount_paid || it.amountPaid || 0),
          })),
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Pembayaran Supplier berhasil disimpan', data: header });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, payment_no, payment_date, supplier_name, bank_name, reference_no, grand_total, items } = body;

    await prisma.purchasePaymentDetail.deleteMany({ where: { headerId: Number(id) } });

    const updated = await prisma.purchasePaymentHeader.update({
      where: { id: Number(id) },
      data: {
        paymentNo: payment_no,
        paymentDate: payment_date ? new Date(payment_date) : undefined,
        supplierName: supplier_name || undefined,
        bankName: bank_name || undefined,
        referenceNo: reference_no || undefined,
        grandTotal: Number(grand_total || 0),
        details: {
          create: (items || []).map((it: any) => ({
            invoiceNo: it.invoice_no || it.inventoryNo || it.invoiceNo || '-',
            amountPaid: Number(it.amount_paid || it.amountPaid || 0),
          })),
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    await prisma.purchasePaymentDetail.deleteMany({ where: { headerId: id } });
    await prisma.purchasePaymentHeader.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

