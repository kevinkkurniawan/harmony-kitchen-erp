import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    const employees = await prisma.employee.findMany({
      where: q
        ? {
            OR: [
              { employeeNo: { contains: q, mode: 'insensitive' } },
              { employeeName: { contains: q, mode: 'insensitive' } },
              { positionName: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        position: true,
      },
      orderBy: { id: 'asc' },
    });

    const mapped = employees.map((e) => ({
      id: e.id,
      employee_no: e.employeeNo,
      employee_name: e.employeeName,
      position_id: e.positionId,
      position_name: e.position?.positionName || e.positionName || 'Staff',
      description: e.description || '',
      is_active: e.isActive,
      created_at: e.createdAt,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/employees:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      employee_no,
      employee_name,
      position_id,
      position_name = 'Staff',
      description = '',
      is_active = true,
    } = body;

    if (!employee_no || !employee_name) {
      return NextResponse.json({ success: false, error: 'Kode / No. Karyawan dan Nama Karyawan wajib diisi' }, { status: 400 });
    }

    const created = await prisma.employee.create({
      data: {
        employeeNo: employee_no,
        employeeName: employee_name,
        positionId: position_id ? Number(position_id) : null,
        positionName: position_name,
        description,
        isActive: Boolean(is_active),
      },
    });

    return NextResponse.json({ success: true, message: 'Karyawan berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/employees:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, employee_no, employee_name, position_id, position_name, description, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Karyawan diperlukan' }, { status: 400 });
    }

    const updated = await prisma.employee.update({
      where: { id: Number(id) },
      data: {
        employeeNo: employee_no,
        employeeName: employee_name,
        positionId: position_id ? Number(position_id) : undefined,
        positionName: position_name,
        description,
        isActive: is_active !== undefined ? Boolean(is_active) : undefined,
      },
    });

    return NextResponse.json({ success: true, message: 'Data Karyawan berhasil diperbarui', data: updated });
  } catch (error: any) {
    console.error('Error in PUT /api/employees:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Karyawan diperlukan' }, { status: 400 });
    }

    await prisma.employee.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: 'Karyawan berhasil dihapus' });
  } catch (error: any) {
    console.error('Error in DELETE /api/employees:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
