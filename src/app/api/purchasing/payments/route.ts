import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    const payments = await prisma.purchasePaymentHeader.findMany({
      where: q
        ? {
            OR: [
              { paymentNo: { contains: q, mode: 'insensitive' } },
              { supplierName: { contains: q, mode: 'insensitive' } },
              { bankName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { details: true },
      orderBy: { id: 'desc' },
    });

    const mapped = payments.map((p) => ({
      id: p.id,
      payment_no: p.paymentNo,
      payment_date: p.paymentDate,
      supplier_name: p.supplierName,
      bank_name: p.bankName,
      reference_no: p.referenceNo || '-',
      grand_total: p.grandTotal,
      created_at: p.createdAt,
      items: p.details.map((d) => ({
        id: d.id,
        invoice_no: d.invoiceNo,
        amount_paid: d.amountPaid,
      })),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/payments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payment_no, payment_date, supplier_name, bank_name, reference_no, grand_total, items } = body;

    if (!payment_no || !supplier_name || !bank_name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Pembayaran, Supplier, Bank, dan detail invoice wajib diisi' }, { status: 400 });
    }

    const created = await prisma.purchasePaymentHeader.create({
      data: {
        paymentNo: payment_no,
        paymentDate: payment_date ? new Date(payment_date) : new Date(),
        supplierName: supplier_name,
        bankName: bank_name,
        referenceNo: reference_no || null,
        grandTotal: Number(grand_total || 0),
        details: {
          create: items.map((it: any) => ({
            invoiceNo: it.invoice_no || it.invoiceNo,
            amountPaid: Number(it.amount_paid || it.amountPaid || 0),
          })),
        },
      },
      include: { details: true },
    });

    return NextResponse.json({ success: true, message: 'Pembayaran Supplier berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/payments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
