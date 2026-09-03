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
            { bankCode: { contains: q, mode: 'insensitive' as const } },
            { bankName: { contains: q, mode: 'insensitive' as const } },
            { accountNo: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, banks] = await Promise.all([
      prisma.bankAccount.count({ where }),
      prisma.bankAccount.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = banks.map((b) => ({
      id: b.id,
      bank_code: b.bankCode,
      bank_name: b.bankName,
      account_no: b.accountNo || b.bankCode,
      account_holder: b.accountHolder || b.bankName,
      is_active: b.isActive,
      created_at: b.createdAt,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/banks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bank_code, bank_name, account_no, account_holder, is_active } = body;

    if (!bank_code || !bank_name) {
      return NextResponse.json({ success: false, error: 'Kode Bank dan Nama Bank wajib diisi' }, { status: 400 });
    }

    const created = await prisma.bankAccount.create({
      data: {
        bankCode: bank_code,
        bankName: bank_name,
        accountNo: account_no || bank_code,
        accountHolder: account_holder || bank_name,
        isActive: is_active !== undefined ? Boolean(is_active) : true,
      },
    });

    return NextResponse.json({ success: true, message: 'Bank berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/banks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, bank_code, bank_name, account_no, account_holder, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Bank diperlukan' }, { status: 400 });
    }

    const updated = await prisma.bankAccount.update({
      where: { id: Number(id) },
      data: {
        bankCode: bank_code,
        bankName: bank_name,
        accountNo: account_no,
        accountHolder: account_holder,
        isActive: is_active !== undefined ? Boolean(is_active) : undefined,
      },
    });

    return NextResponse.json({ success: true, message: 'Data Bank berhasil diperbarui', data: updated });
  } catch (error: any) {
    console.error('Error in PUT /api/banks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Bank diperlukan' }, { status: 400 });
    }

    await prisma.bankAccount.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: 'Bank berhasil dihapus' });
  } catch (error: any) {
    console.error('Error in DELETE /api/banks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
