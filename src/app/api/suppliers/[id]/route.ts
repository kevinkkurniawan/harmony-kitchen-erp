import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function mapSupplier(s: any) {
  return {
    id: Number(s.id),
    supplierNo: s.supplierno,
    supplierName: s.suppliername || '',
    supplierType: s.suppliertypeid === 2 ? 'Import' : 'Lokal',
    address: s.address || '',
    city: s.city || '',
    phone1: s.phone1 || '',
    phone2: s.phone2 || '',
    fax: s.fax || '',
    email: s.email || '',
    contactPerson: s.contact_person || '',
    contactPersonAddress: s.contact_person_address || '',
    contactPersonPhone1: s.contact_person_phone1 || '',
    contactPersonPhone2: s.contact_person_phone2 || '',
    taxNo: s.taxno || '',
    isTaxable: Boolean(s.istaxable),
    description: s.description || '',
    isActive: s.postcode !== 'INACTIVE',
    bankId: s.bankid?.toString() || '',
    bankAccount: s.bankaccount || '',
    onBehalfOf: s.onbehalfof || '',
    creditLimit: s.credit_limit ? Number(s.credit_limit) : 0,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await prisma.m_supplier.findUnique({ where: { id: BigInt(id) } });
    if (!s) return NextResponse.json({ success: false, error: 'Supplier tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ success: true, data: mapSupplier(s) });
  } catch (error: any) {
    console.error("GET Supplier [id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: any = {};
    if (body.supplierNo !== undefined) {
      const trimmedNo = String(body.supplierNo).trim();
      if (!trimmedNo) {
        return NextResponse.json({ success: false, error: 'Kode Supplier tidak boleh kosong' }, { status: 400 });
      }
      updateData.supplierno = trimmedNo;
    }
    if (body.supplierName !== undefined) {
      const trimmedName = String(body.supplierName).trim();
      if (!trimmedName) {
        return NextResponse.json({ success: false, error: 'Nama Supplier tidak boleh kosong' }, { status: 400 });
      }
      updateData.suppliername = trimmedName;
    }
    if (body.supplierType !== undefined) updateData.suppliertypeid = body.supplierType === 'Import' ? 2 : 1;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.isActive !== undefined) updateData.postcode = body.isActive === false ? 'INACTIVE' : null;
    if (body.phone1 !== undefined) updateData.phone1 = body.phone1;
    if (body.phone2 !== undefined) updateData.phone2 = body.phone2;
    if (body.fax !== undefined) updateData.fax = body.fax;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.contactPerson !== undefined) updateData.contact_person = body.contactPerson;
    if (body.contactPersonAddress !== undefined) updateData.contact_person_address = body.contactPersonAddress;
    if (body.contactPersonPhone1 !== undefined) updateData.contact_person_phone1 = body.contactPersonPhone1;
    if (body.contactPersonPhone2 !== undefined) updateData.contact_person_phone2 = body.contactPersonPhone2;
    if (body.taxNo !== undefined) updateData.taxno = body.taxNo;
    if (body.isTaxable !== undefined) updateData.istaxable = Boolean(body.isTaxable);
    if (body.description !== undefined) updateData.description = body.description;
    if (body.bankId !== undefined) updateData.bankid = body.bankId ? parseInt(body.bankId, 10) : null;
    if (body.bankAccount !== undefined) updateData.bankaccount = body.bankAccount;
    if (body.onBehalfOf !== undefined) updateData.onbehalfof = body.onBehalfOf;
    if (body.creditLimit !== undefined) updateData.credit_limit = body.creditLimit ? Number(body.creditLimit) : 0;

    const updated = await prisma.m_supplier.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: mapSupplier(updated) });
  } catch (error: any) {
    console.error("PUT Supplier [id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.m_supplier.delete({
      where: { id: BigInt(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Supplier [id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}