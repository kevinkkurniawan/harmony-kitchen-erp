import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);
    const where = q ? { OR: [{ customerno: { contains: q, mode: 'insensitive' as const } }, { customername: { contains: q, mode: 'insensitive' as const } }] } : undefined;
    const [total, items] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = items.map((c) => ({ id: c.id, customer_code: c.customerno, customer_name: c.customername, customer_type: 'Umum', address: c.address, city: c.city, phone: c.phone1, fax: c.fax, email: '', contact_person: c.contactPerson, credit_limit: 0, is_active: true, created_at: c.createddate }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.customer.create({ data: { customerno: body.customer_code, customername: body.customer_name, customertypeid: 1, address: body.address, city: body.city, phone1: body.phone, fax: body.fax, contactPerson: body.contact_person } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const updated = await prisma.customer.update({ where: { id: Number(body.id) }, data: { customerno: body.customer_code, customername: body.customer_name, customertypeid: 1, address: body.address, city: body.city, phone1: body.phone, fax: body.fax, contactPerson: body.contact_person } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    await prisma.customer.delete({ where: { id: Number(searchParams.get('id')) } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}