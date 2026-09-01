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
    const { supplier_code, supplier_name, supplier_type, address, city, phone, email, contact_person, is_active } = body;

    if (!supplier_code || !supplier_name) {
      return NextResponse.json({ success: false, error: 'Kode Supplier dan Nama Supplier wajib diisi' }, { status: 400 });
    }

    const created = await prisma.supplier.create({
      data: {
        supplierCode: supplier_code,
        supplierName: supplier_name,
        supplierType: supplier_type || 'Lokal Utama',
        address,
        city,
        phone,
        email,
        contactPerson: contact_person,
        isActive: is_active !== undefined ? Boolean(is_active) : true,
      },
    });

    return NextResponse.json({ success: true, message: 'Supplier berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/suppliers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
