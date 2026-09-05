import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const i = await prisma.inventory.findUnique({ where: { id: Number(id) } });
    if (!i) return NextResponse.json({ success: false }, { status: 404 });
    const mapped = { id: i.id, barcode: i.barcode, inventory_no: i.inventoryno, inventory_name: i.inventoryname, category_id: null, brand_id: null, uom_id: null, hpp: 0, price: i.price, grosir1: i.grosir1, grosir2: i.grosir2, grosir3: i.grosir3, stock: 0, is_active: true };
    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await prisma.inventory.update({ where: { id: Number(id) }, data: { inventoryno: body.inventory_no, inventoryname: body.inventory_name, price: Number(body.price) || 0 } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.inventory.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}