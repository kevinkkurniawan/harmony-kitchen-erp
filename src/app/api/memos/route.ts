import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = { memotype: 'GENERAL' };
    if (q) {
      where.OR = [
        { memocode: { contains: q, mode: 'insensitive' as const } },
        { memoreason: { contains: q, mode: 'insensitive' as const } },
        { remarks: { contains: q, mode: 'insensitive' as const } },
        { createduser: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, memos] = await Promise.all([
      prisma.t_memoheader.count({ where }),
      prisma.t_memoheader.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = memos.map((m: any) => ({
      id: m.id,
      memo_no: m.memocode,
      title: m.memoreason || '-',
      content: m.remarks || '-',
      author: m.createduser || 'Manager',
      status: m.isdone ? 'CLOSED' : 'OPEN',
      created_at: m.createddate,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/memos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { memo_no, title, content, author = 'Manager', status = 'OPEN' } = body;

    if (!memo_no || !title || !content) {
      return NextResponse.json({ success: false, error: 'No. Memo, Judul, dan Isi Memo wajib diisi' }, { status: 400 });
    }

    const created = await prisma.t_memoheader.create({
      data: {
        memocode: memo_no,
        memoreason: title,
        remarks: content,
        memotype: 'GENERAL',
        createduser: author,
        createddate: new Date(),
        modifieduser: author,
        modifieddate: new Date(),
        isdone: status === 'CLOSED',
        isvoid: false,
      },
    });

    return NextResponse.json({ success: true, message: 'Memo berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/memos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, title, content, status } = body;

    const updated = await prisma.t_memoheader.update({
      where: { id: Number(id) },
      data: {
        memoreason: title,
        remarks: content,
        isdone: status === 'CLOSED',
        modifieddate: new Date(),
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    await prisma.t_memoheader.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
