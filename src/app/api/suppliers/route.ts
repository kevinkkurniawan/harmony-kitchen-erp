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
      supplierNo: s.supplierCode,
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

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/suppliers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supplier_code = body.supplier_code || body.supplierNo;
    const supplier_name = body.supplier_name || body.supplierName;
    const supplier_type = body.supplier_type || body.supplierType || 'Lokal Utama';
    const address = body.address;
    const city = body.city;
    const phone = body.phone || body.phone1;
    const email = body.email;
    const contact_person = body.contact_person || body.contactPerson;
    const is_active = body.is_active !== undefined ? body.is_active : body.isActive;

    if (!supplier_code || !supplier_name) {
      return NextResponse.json({ success: false, error: 'Kode Supplier dan Nama Supplier wajib diisi' }, { status: 400 });
    }

    const created = await prisma.supplier.create({
      data: {
        supplierCode: supplier_code,
        supplierName: supplier_name,
        supplierType: supplier_type,
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
