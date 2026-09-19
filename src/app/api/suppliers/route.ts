import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const onlyTaxable = searchParams.get('onlyTaxable') === 'true';
    const type = searchParams.get('type');
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {};
    if (q) {
      where.OR = [
        { supplierno: { contains: q, mode: 'insensitive' } },
        { suppliername: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (type) {
      where.suppliertypeid = type === 'Import' ? 2 : 1;
    }
    if (onlyTaxable) {
      where.istaxable = true;
    }
    // OnlyActive isn't natively in this DB model as 'isactive', but if there is one we'd use it. For now omit if not in DB.

    const [total, items] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);

    const mapped = items.map((s) => ({
      id: s.id,
      supplierNo: s.supplierno,
      supplierName: s.suppliername || '',
      supplierType: s.suppliertypeid === 2 ? 'Import' : 'Lokal',
      address: s.address || '',
      city: s.city || '',
      phone1: s.phone1 || '',
      phone2: s.phone2 || '',
      fax: s.fax || '',
      email: s.email || '',
      contactPerson: s.contactPerson || '',
      contactPersonAddress: s.contact_person_address || '',
      contactPersonPhone1: s.contact_person_phone1 || '',
      contactPersonPhone2: s.contact_person_phone2 || '',
      taxNo: s.taxno || '',
      isTaxable: Boolean(s.istaxable),
      description: s.description || '',
      isActive: true, // Placeholder if no isactive column exists
      bankId: s.bankid?.toString() || '',
      bankAccount: s.bankaccount || '',
      onBehalfOf: s.onbehalfof || '',
      creditLimit: s.credit_limit ? Number(s.credit_limit) : 0,
    }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error("GET Suppliers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.supplier.create({
      data: {
        supplierno: body.supplierNo,
        suppliername: body.supplierName,
        suppliertypeid: body.supplierType === 'Import' ? 2 : 1,
        address: body.address,
        city: body.city,
        phone1: body.phone1 || '',
        phone2: body.phone2,
        fax: body.fax,
        email: body.email,
        contactPerson: body.contactPerson,
        contact_person_address: body.contactPersonAddress,
        contact_person_phone1: body.contactPersonPhone1,
        contact_person_phone2: body.contactPersonPhone2,
        taxno: body.taxNo,
        istaxable: Boolean(body.isTaxable),
        description: body.description,
        bankid: body.bankId ? parseInt(body.bankId, 10) : null,
        bankaccount: body.bankAccount,
        onbehalfof: body.onBehalfOf,
        credit_limit: body.creditLimit ? Number(body.creditLimit) : 0,
      }
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error("POST Supplier error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    
    // Support partial updates (e.g., status toggles if we add an isactive column later)
    const updateData: any = {};
    if (body.supplierNo !== undefined) updateData.supplierno = body.supplierNo;
    if (body.supplierName !== undefined) updateData.suppliername = body.supplierName;
    if (body.supplierType !== undefined) updateData.suppliertypeid = body.supplierType === 'Import' ? 2 : 1;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.phone1 !== undefined) updateData.phone1 = body.phone1;
    if (body.phone2 !== undefined) updateData.phone2 = body.phone2;
    if (body.fax !== undefined) updateData.fax = body.fax;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson;
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

    const updated = await prisma.supplier.update({
      where: { id: Number(body.id) },
      data: updateData
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT Supplier error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    if (!id) throw new Error("Missing ID");
    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Supplier error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}