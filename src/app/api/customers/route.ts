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
          ],
        }
      : undefined;
    const [total, items] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = items.map((c) => ({
      id: c.id,
      customer_code: c.customerCode,
      customer_name: c.customerName,
      customer_type: c.customerType || 'Reguler',
      address: c.address,
      city: c.city,
      phone: c.phone,
      fax: c.fax,
      email: c.email,
      contact_person: c.contactPerson,
      credit_limit: c.creditLimit,
      is_active: c.isActive,
      created_at: c.createdAt,
    }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.customer.create({
      data: {
        customerCode: body.customer_code,
        customerName: body.customer_name,
        customerType: body.customer_type || 'Reguler',
        address: body.address,
        city: body.city,
        phone: body.phone,
        fax: body.fax,
        email: body.email,
        contactPerson: body.contact_person,
        creditLimit: Number(body.credit_limit) || 0,
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
    const updated = await prisma.customer.update({
      where: { id: Number(body.id) },
      data: {
        customerCode: body.customer_code,
        customerName: body.customer_name,
        customerType: body.customer_type || 'Reguler',
        address: body.address,
        city: body.city,
        phone: body.phone,
        fax: body.fax,
        email: body.email,
        contactPerson: body.contact_person,
        creditLimit: Number(body.credit_limit) || 0,
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
    await prisma.customer.delete({ where: { id: Number(searchParams.get('id')) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}