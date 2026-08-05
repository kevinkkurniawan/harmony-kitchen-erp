import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';

    const whereCondition: any = {};
    if (onlyActive) {
      whereCondition.isActive = true;
    }
    if (q) {
      whereCondition.OR = [
        { supplierCode: { contains: q, mode: 'insensitive' } },
        { supplierName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where: whereCondition,
      orderBy: { id: 'asc' },
    });

    const mapped = suppliers.map((s) => ({
      id: s.id,
      supplier_code: s.supplierCode,
      supplier_name: s.supplierName,
      supplier_type: s.supplierType,
      address: s.address || '',
      city: s.city || '',
      phone: s.phone || '',
      email: s.email || '',
      contact_person: s.contactPerson || '',
      is_active: s.isActive,
      created_at: s.createdAt,
    }));

    return NextResponse.json({ success: true, data: mapped });
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
