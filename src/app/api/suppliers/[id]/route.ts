import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await prisma.supplier.findUnique({ where: { id: Number(id) } });
    if (!s) return NextResponse.json({ success: false }, { status: 404 });
    const mapped = { id: s.id, supplier_code: s.supplierno, supplier_name: s.suppliername, supplier_type: 'Lokal', address: s.address, city: s.city, phone: s.phone1, phone2: s.phone2, fax: s.fax, email: '', contact_person: s.contactPerson, tax_no: s.taxno, is_taxable: s.istaxable, description: '', is_active: true, created_at: s.createddate };
    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}