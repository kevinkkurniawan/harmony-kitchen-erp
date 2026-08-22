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
            { customerCode: { contains: q, mode: 'insensitive' as const } },
            { customerName: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q, mode: 'insensitive' as const } },
            { address: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = customers.map((c) => ({
      id: c.id,
      customer_code: c.customerCode,
      customer_name: c.customerName,
      customer_type: c.customerType,
      address: c.address || '',
      city: c.city || '',
      phone: c.phone || '',
      email: c.email || '',
      contact_person: c.contactPerson || '',
      credit_limit: c.creditLimit,
      is_active: c.isActive,
      created_at: c.createdAt,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customer_code, customer_name, customer_type, address, phone, email, contact_person, credit_limit, is_active } = body;

    if (!customer_code || !customer_name) {
      return NextResponse.json({ success: false, error: 'Kode Customer dan Nama Customer wajib diisi' }, { status: 400 });
    }

    const created = await prisma.customer.create({
      data: {
        customerCode: customer_code,
        customerName: customer_name,
        customerType: customer_type || 'Reguler',
        address,
        phone,
        email,
        contactPerson: contact_person,
        creditLimit: credit_limit ? Number(credit_limit) : 0,
        isActive: is_active !== undefined ? Boolean(is_active) : true,
      },
    });

    return NextResponse.json({ success: true, message: 'Customer berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, customer_code, customer_name, customer_type, address, phone, email, contact_person, credit_limit, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Customer diperlukan' }, { status: 400 });
    }

    const updated = await prisma.customer.update({
      where: { id: Number(id) },
      data: {
        customerCode: customer_code,
        customerName: customer_name,
        customerType: customer_type,
        address,
        phone,
        email,
        contactPerson: contact_person,
        creditLimit: credit_limit !== undefined ? Number(credit_limit) : undefined,
        isActive: is_active !== undefined ? Boolean(is_active) : undefined,
      },
    });

    return NextResponse.json({ success: true, message: 'Data Customer berhasil diperbarui', data: updated });
  } catch (error: any) {
    console.error('Error in PUT /api/customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Customer diperlukan' }, { status: 400 });
    }

    await prisma.customer.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: 'Customer berhasil dihapus' });
  } catch (error: any) {
    console.error('Error in DELETE /api/customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
