import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const memos = await prisma.memo.findMany({
      orderBy: { id: 'desc' },
    });

    const mapped = memos.map((m) => ({
      id: m.id,
      memo_no: m.memoNo,
      title: m.title,
      content: m.content,
      author: m.author,
      status: m.status,
      created_at: m.createdAt,
    }));

    return NextResponse.json({ success: true, data: mapped });
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

    const created = await prisma.memo.create({
      data: {
        memoNo: memo_no,
        title,
        content,
        author,
        status,
      },
    });

    return NextResponse.json({ success: true, message: 'Memo berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/memos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
