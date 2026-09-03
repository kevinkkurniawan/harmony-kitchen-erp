import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const onlyTaxable = searchParams.get('onlyTaxable') === 'true';
    const paginationParams = getPaginationParams(request, 50, 1000);

    const whereCondition: any = {};
    if (onlyActive) {
      whereCondition.isActive = true;
    }
    if (onlyTaxable) {
      whereCondition.isTaxable = true;
    }
    if (q) {
      whereCondition.OR = [
        { supplierCode: { contains: q, mode: 'insensitive' } },
        { supplierName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where: whereCondition }),
      prisma.supplier.findMany({
        where: whereCondition,
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = suppliers.map((s) => ({
      id: String(s.id),
      supplierNo: s.supplierCode,
      supplierCode: s.supplierCode,
      supplier_code: s.supplierCode,
      supplierName: s.supplierName,
      supplier_name: s.supplierName,
      supplierType: s.supplierType,
      supplier_type: s.supplierType,
      address: s.address || '',
      city: s.city || '',
      phone: s.phone || '',
      phone1: s.phone || '',
      email: s.email || '',
      contactPerson: s.contactPerson || '',
      contact_person: s.contactPerson || '',
      isActive: s.isActive,
      is_active: s.isActive,
      created_at: s.createdAt,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/suppliers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supplierCode = body.supplierCode || body.supplierNo || body.supplier_code || `SUP-${Date.now().toString().slice(-4)}`;
    const supplierName = body.supplierName || body.supplier_name;
    const supplierType = body.supplierType || body.supplier_type || 'Lokal Utama';
    const address = body.address;
    const city = body.city;
    const phone = body.phone1 || body.phone || body.phone2;
    const email = body.email;
    const contactPerson = body.contactPerson || body.contact_person;
    const isActive = body.isActive ?? body.is_active ?? true;

    if (!supplierName) {
      return NextResponse.json({ success: false, error: 'Nama Supplier wajib diisi' }, { status: 400 });
    }

    const created = await prisma.supplier.create({
      data: {
        supplierCode: supplierCode,
        supplierName: supplierName,
        supplierType: supplierType,
        address: address || '',
        city: city || '',
        phone: phone || '',
        email: email || '',
        contactPerson: contactPerson || '',
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json({ success: true, message: 'Supplier berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/suppliers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
