import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await prisma.supplier.findUnique({ where: { id: Number(id) } });
    if (!s) return NextResponse.json({ success: false }, { status: 404 });
    const mapped = {
      id: s.id,
      supplier_code: s.supplierCode,
      supplier_name: s.supplierName,
      supplier_type: s.supplierType || 'Lokal',
      address: s.address,
      city: s.city,
      phone: s.phone,
      phone2: s.phone2,
      fax: s.fax,
      email: s.email,
      contact_person: s.contactPerson,
      tax_no: s.taxNo,
      is_taxable: s.isTaxable,
      description: s.description || '',
      is_active: s.isActive,
      created_at: s.createdAt,
    };
    return NextResponse.json({ success: true, data: mapped });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}