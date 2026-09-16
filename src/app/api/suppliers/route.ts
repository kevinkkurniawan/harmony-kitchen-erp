import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);
    const where = q
      ? {
          OR: [
            { supplierCode: { contains: q, mode: 'insensitive' as const } },
            { supplierName: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;
    const [total, items] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = items.map((s) => ({
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
    }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.supplier.create({
      data: {
        supplierCode: body.supplier_code,
        supplierName: body.supplier_name,
        supplierType: body.supplier_type || 'Lokal',
        address: body.address,
        city: body.city,
        phone: body.phone,
        phone2: body.phone2,
        fax: body.fax,
        email: body.email,
        contactPerson: body.contact_person,
        taxNo: body.tax_no,
        isTaxable: Boolean(body.is_taxable),
        description: body.description,
      },
    });
    return NextResponse.json({ success: true, data: created });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const updated = await prisma.supplier.update({
      where: { id: Number(body.id) },
      data: {
        supplierCode: body.supplier_code,
        supplierName: body.supplier_name,
        supplierType: body.supplier_type || 'Lokal',
        address: body.address,
        city: body.city,
        phone: body.phone,
        phone2: body.phone2,
        fax: body.fax,
        email: body.email,
        contactPerson: body.contact_person,
        taxNo: body.tax_no,
        isTaxable: Boolean(body.is_taxable),
        description: body.description,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    await prisma.supplier.delete({ where: { id: Number(searchParams.get('id')) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}