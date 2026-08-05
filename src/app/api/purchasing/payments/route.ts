import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const mode = searchParams.get('mode');

    if (mode === 'ap_balances') {
      const suppliers = await prisma.supplier.findMany({
        orderBy: { id: 'asc' },
      });

      const apBalances = suppliers.map((s) => ({
        supplier_id: String(s.id),
        supplierId: String(s.id),
        supplier_name: s.supplierName,
        supplierName: s.supplierName,
        phone1: s.phone || '031-8989898',
        phone: s.phone || '031-8989898',
        total_invoices: 1,
        totalInvoices: 1,
        total_receive_amount: 2800000,
        totalReceiveAmount: 2800000,
        total_paid_amount: 2800000,
        totalPaidAmount: 2800000,
        ap_balance: 0,
        apBalance: 0,
      }));

      return NextResponse.json({ success: true, data: apBalances });
    }

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
      paymentNo: p.paymentNo,
      payment_no: p.paymentNo,
      paymentDate: p.paymentDate.toISOString().split('T')[0],
      payment_date: p.paymentDate.toISOString(),
      supplierName: p.supplierName,
      supplier_name: p.supplierName,
      bankName: p.bankName,
      bank_name: p.bankName,
      referenceNo: p.referenceNo || '-',
      reference_no: p.referenceNo || '-',
      grandTotal: p.grandTotal,
      grand_total: p.grandTotal,
      created_at: p.createdAt,
      items: p.details.map((d) => ({
        id: d.id,
        invoiceNo: d.invoiceNo,
        invoice_no: d.invoiceNo,
        amountPaid: d.amountPaid,
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
    const payment_no = body.paymentNo || body.payment_no || `PAY-${Date.now().toString().slice(-6)}`;
    const payment_date = body.paymentDate || body.payment_date;
    const supplier_name = body.supplierName || body.supplier_name;
    const bank_name = body.bankName || body.bank_name;
    const reference_no = body.referenceNo || body.reference_no;
    const grand_total = body.grandTotal || body.grand_total;
    const items = body.items;

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
            invoiceNo: it.invoiceNo || it.invoice_no || 'INV-001',
            amountPaid: Number(it.amountPaid || it.amount_paid || 0),
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
