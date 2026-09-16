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
            { bankName: { contains: q, mode: 'insensitive' as const } },
            { bankCode: { contains: q, mode: 'insensitive' as const } },
            { accountNo: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;
    const [total, banks] = await Promise.all([
      prisma.bankAccount.count({ where }),
      prisma.bankAccount.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = banks.map((b) => ({
      id: b.id,
      bank_code: b.bankCode,
      bank_name: b.bankName,
      account_no: b.accountNo || '',
      account_holder: b.accountHolder || '',
      is_active: b.isActive,
      created_at: b.createdAt,
    }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.bankAccount.create({
      data: {
        bankCode: String(body.bank_code || ''),
        bankName: String(body.bank_name || ''),
        accountNo: body.account_no ? String(body.account_no) : null,
        accountHolder: body.account_holder ? String(body.account_holder) : null,
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
    const updated = await prisma.bankAccount.update({
      where: { id: Number(body.id) },
      data: {
        bankCode: String(body.bank_code || ''),
        bankName: String(body.bank_name || ''),
        accountNo: body.account_no ? String(body.account_no) : null,
        accountHolder: body.account_holder ? String(body.account_holder) : null,
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
    await prisma.bankAccount.delete({ where: { id: Number(searchParams.get('id')) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}