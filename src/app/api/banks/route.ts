import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);
    const where = q ? { OR: [{ accountname: { contains: q, mode: 'insensitive' as const } }] } : undefined;
    const [total, banks] = await Promise.all([
      prisma.m_account.count({ where }),
      prisma.m_account.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = banks.map((b) => ({ id: b.id, bank_code: b.accountno?.toString() || '', bank_name: b.accountname, account_no: b.accountno?.toString() || '', account_holder: b.accountname, is_active: true, created_at: b.modifieddate }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.m_account.create({ data: { accountno: Number(body.bank_code) || 0, accountname: body.bank_name } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const updated = await prisma.m_account.update({ where: { id: Number(body.id) }, data: { accountno: Number(body.bank_code) || 0, accountname: body.bank_name } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    await prisma.m_account.delete({ where: { id: Number(searchParams.get('id')) } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}