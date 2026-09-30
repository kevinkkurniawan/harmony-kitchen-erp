import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const onlyTaxable = searchParams.get('onlyTaxable') === 'true';
    const type = searchParams.get('type');
    const paginationParams = getPaginationParams(req, 1000, 2000);

    const andConditions: any[] = [];
    if (q) {
      andConditions.push({
        OR: [
          { supplierno: { contains: q, mode: 'insensitive' } },
          { suppliername: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { contact_person: { contains: q, mode: 'insensitive' } },
          { phone1: { contains: q, mode: 'insensitive' } },
          { phone2: { contains: q, mode: 'insensitive' } },
          { taxno: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (type) {
      andConditions.push({ suppliertypeid: type === 'Import' ? 2 : 1 });
    }
    if (onlyTaxable) {
      andConditions.push({ istaxable: true });
    }
    if (onlyActive) {
      andConditions.push({
        OR: [
          { postcode: null },
          { postcode: { not: 'INACTIVE' } },
        ],
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [total, items] = await Promise.all([
      prisma.m_supplier.count({ where }),
      prisma.m_supplier.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);

    const mapped = items.map(mapSupplier);
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error("GET Suppliers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supplierNo = String(body.supplierNo || '').trim();
    const supplierName = String(body.supplierName || '').trim();
    if (!supplierNo || !supplierName) {
      return NextResponse.json({ success: false, error: 'Kode Supplier dan Nama Supplier wajib diisi' }, { status: 400 });
    }

    const created = await prisma.m_supplier.create({
      data: {
        supplierno: supplierNo,
        suppliername: supplierName,
        suppliertypeid: body.supplierType === 'Import' ? 2 : 1,
        address: body.address || '',
        city: body.city || '',
        postcode: body.isActive === false ? 'INACTIVE' : null,
        phone1: body.phone1 || '',
        phone2: body.phone2 || '',
        fax: body.fax || '',
        email: body.email || '',
        contact_person: body.contactPerson || '',
        contact_person_address: body.contactPersonAddress || '',
        contact_person_phone1: body.contactPersonPhone1 || '',
        contact_person_phone2: body.contactPersonPhone2 || '',
        taxno: body.taxNo || '',
        istaxable: Boolean(body.isTaxable),
        description: body.description || '',
        bankid: body.bankId ? parseInt(body.bankId, 10) : null,
        bankaccount: body.bankAccount || '',
        onbehalfof: body.onBehalfOf || '',
        credit_limit: body.creditLimit ? Number(body.creditLimit) : 0,
      }
    });
    return NextResponse.json({ success: true, data: mapSupplier(created) });
  } catch (error: any) {
    console.error("POST Supplier error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const updateData: any = {};
    if (body.supplierNo !== undefined) updateData.supplierno = String(body.supplierNo).trim();
    if (body.supplierName !== undefined) updateData.suppliername = String(body.supplierName).trim();
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
      where: { id: BigInt(body.id) },
      data: updateData
    });
    return NextResponse.json({ success: true, data: mapSupplier(updated) });
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
    await prisma.m_supplier.delete({ where: { id: BigInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Supplier error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}