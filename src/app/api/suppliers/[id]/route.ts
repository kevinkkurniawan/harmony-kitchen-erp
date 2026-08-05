import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      supplierNo,
      supplierName,
      address,
      city,
      phone1,
      phone2,
      fax,
      contactPerson,
      email,
      taxNo,
      isTaxable,
      description,
      isActive,
    } = body;

    const updateQuery = `
      UPDATE m_supplier SET
        supplier_no = COALESCE($1, supplier_no),
        supplier_name = COALESCE($2, supplier_name),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        phone1 = COALESCE($5, phone1),
        phone2 = COALESCE($6, phone2),
        fax = COALESCE($7, fax),
        contact_person = COALESCE($8, contact_person),
        email = COALESCE($9, email),
        tax_no = COALESCE($10, tax_no),
        is_taxable = COALESCE($11, is_taxable),
        description = COALESCE($12, description),
        is_active = COALESCE($13, is_active)
      WHERE id = $14;
    `;

    const values = [
      supplierNo,
      supplierName,
      address,
      city,
      phone1,
      phone2,
      fax,
      contactPerson,
      email,
      taxNo,
      isTaxable !== undefined ? isTaxable : null,
      description,
      isActive !== undefined ? isActive : null,
      parseInt(id),
    ];

    await pool.query(updateQuery, values);
    return NextResponse.json({ success: true, message: 'Supplier berhasil diperbarui' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await pool.query(`DELETE FROM m_supplier WHERE id = $1`, [parseInt(id)]);
    return NextResponse.json({ success: true, message: 'Supplier berhasil dihapus' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
