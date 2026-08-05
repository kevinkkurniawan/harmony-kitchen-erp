import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    const orders = await prisma.purchaseOrderHeader.findMany({
      where: q
        ? {
            OR: [
              { poNo: { contains: q, mode: 'insensitive' } },
              { supplierName: { contains: q, mode: 'insensitive' } },
              { status: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { details: true },
      orderBy: { id: 'desc' },
    });

    const mapped = orders.map((po) => ({
      id: po.id,
      po_no: po.poNo,
      po_date: po.poDate,
      supplier_name: po.supplierName,
      delivery_date: po.deliveryDate,
      description: po.description || '',
      subtotal: po.subtotal,
      tax: po.tax,
      grand_total: po.grandTotal,
      status: po.status,
      created_at: po.createdAt,
      items: po.details.map((d) => ({
        id: d.id,
        barcode: d.barcode,
        inventory_no: d.inventoryNo,
        inventory_name: d.inventoryName,
        qty: d.qty,
        unit_price: d.unitPrice,
        subtotal: d.subtotal,
      })),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { po_no, po_date, supplier_name, delivery_date, description, subtotal, tax, grand_total, status = 'Approved', items } = body;

    if (!po_no || !supplier_name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. PO, Supplier, dan detail item barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.purchaseOrderHeader.create({
      data: {
        poNo: po_no,
        poDate: po_date ? new Date(po_date) : new Date(),
        supplierName: supplier_name,
        deliveryDate: delivery_date ? new Date(delivery_date) : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        description,
        subtotal: Number(subtotal || 0),
        tax: Number(tax || 0),
        grandTotal: Number(grand_total || 0),
        status,
        details: {
          create: items.map((it: any) => ({
            barcode: it.barcode,
            inventoryNo: it.inventory_no || it.inventoryNo,
            inventoryName: it.inventory_name || it.inventoryName,
            qty: Number(it.qty),
            unitPrice: Number(it.unit_price || it.unitPrice || 0),
            subtotal: Number(it.subtotal || 0),
          })),
        },
      },
      include: { details: true },
    });

    return NextResponse.json({ success: true, message: 'Purchase Order berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
