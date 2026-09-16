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
            { employeeNo: { contains: q, mode: 'insensitive' as const } },
            { employeeName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;
    const [total, emps] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = emps.map((e) => ({
      id: e.id,
      employee_no: e.employeeNo,
      employee_name: e.employeeName,
      position_id: e.positionId,
      position_name: e.positionName || '',
      description: e.description || '',
      is_active: e.isActive,
      created_at: e.createdAt,
    }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.employee.create({
      data: {
        employeeNo: body.employee_no,
        employeeName: body.employee_name,
        positionId: body.position_id ? Number(body.position_id) : null,
        positionName: body.position_name || null,
        description: body.description || null,
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
    const updated = await prisma.employee.update({
      where: { id: Number(body.id) },
      data: {
        employeeNo: body.employee_no,
        employeeName: body.employee_name,
        positionId: body.position_id ? Number(body.position_id) : null,
        positionName: body.position_name || null,
        description: body.description || null,
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
    await prisma.employee.delete({ where: { id: Number(searchParams.get('id')) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}