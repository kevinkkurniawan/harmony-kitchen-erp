import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);
    const where = q ? { OR: [{ supplierno: { contains: q, mode: 'insensitive' as const } }, { suppliername: { contains: q, mode: 'insensitive' as const } }] } : undefined;
    const [total, items] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = items.map((s) => ({ id: s.id, supplier_code: s.supplierno, supplier_name: s.suppliername, supplier_type: 'Lokal', address: s.address, city: s.city, phone: s.phone1, phone2: s.phone2, fax: s.fax, email: '', contact_person: s.contactPerson, tax_no: s.taxno, is_taxable: s.istaxable, description: '', is_active: true, created_at: s.createddate }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.supplier.create({ data: { supplierno: body.supplier_code, suppliername: body.supplier_name, suppliertypeid: 1, address: body.address, city: body.city, phone1: body.phone, phone2: body.phone2, fax: body.fax, contactPerson: body.contact_person, taxno: body.tax_no, istaxable: Boolean(body.is_taxable) } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const updated = await prisma.supplier.update({ where: { id: Number(body.id) }, data: { supplierno: body.supplier_code, suppliername: body.supplier_name, suppliertypeid: 1, address: body.address, city: body.city, phone1: body.phone, phone2: body.phone2, fax: body.fax, contactPerson: body.contact_person, taxno: body.tax_no, istaxable: Boolean(body.is_taxable) } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    await prisma.supplier.delete({ where: { id: Number(searchParams.get('id')) } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}