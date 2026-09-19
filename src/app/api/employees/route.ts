import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);
    const where = q ? { OR: [{ employeeno: { contains: q, mode: 'insensitive' as const } }, { employeename: { contains: q, mode: 'insensitive' as const } }] } : undefined;
    const [total, emps] = await Promise.all([
      prisma.m_employee.count({ where }),
      prisma.m_employee.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = emps.map((e) => ({ id: Number(e.id), employee_no: e.employeeno, employee_name: e.employeename, position_id: null, position_name: '', description: '', is_active: true, created_at: e.createddate }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.m_employee.create({ data: { employeeno: body.employee_no, employeename: body.employee_name } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const updated = await prisma.m_employee.update({ where: { id: Number(body.id) }, data: { employeeno: body.employee_no, employeename: body.employee_name } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    await prisma.m_employee.delete({ where: { id: Number(searchParams.get('id')) } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}