import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({
      where: { id: Number(id) },
    });

    if (!supplier) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: supplier });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supplierCode = body.supplierCode || body.supplierNo || body.supplier_code;
    const supplierName = body.supplierName || body.supplier_name;
    const supplierType = body.supplierType || body.supplier_type;
    const address = body.address;
    const city = body.city;
    const phone = body.phone1 || body.phone || body.phone2;
    const email = body.email;
    const contactPerson = body.contactPerson || body.contact_person;
    const isActive = body.isActive ?? body.is_active;

    const updated = await prisma.supplier.update({
      where: { id: Number(id) },
      data: {
        supplierCode: supplierCode || undefined,
        supplierName: supplierName || undefined,
        supplierType: supplierType || undefined,
        address: address !== undefined ? address : undefined,
        city: city !== undefined ? city : undefined,
        phone: phone !== undefined ? phone : undefined,
        email: email !== undefined ? email : undefined,
        contactPerson: contactPerson !== undefined ? contactPerson : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    return NextResponse.json({ success: true, message: 'Supplier berhasil diperbarui', data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.supplier.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: 'Supplier berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
