import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { resolveSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {
      isPriced: true,
    };
    if (q) {
      where.OR = [
        { mrNo: { contains: q, mode: 'insensitive' as const } },
        { poNo: { contains: q, mode: 'insensitive' as const } },
        { supplierName: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, receives] = await Promise.all([
      prisma.materialReceiveHeader.count({ where }),
      prisma.materialReceiveHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = receives.map((mr) => {
      const result: any = {
        id: mr.id,
        mr_no: mr.mrNo,
        mr_date: mr.mrDate.toISOString(),
        po_no: mr.poNo || '-',
        do_no: mr.doNo || '-',
        supplier_id: mr.supplierId,
        supplier_name: mr.supplierName,
        driver_name: mr.driverName || '-',
        vehicle_no: mr.vehicleNo || '-',
        wh_name: mr.whName || 'Gudang Utama',
        description: mr.description || '-',
        is_express: mr.isExpress,
        is_void: mr.isVoid,
        is_priced: mr.isPriced,
        payment_type: mr.paymentType || '-',
        due_date: mr.dueDate ? mr.dueDate.toISOString() : null,
        created_at: mr.createdAt.toISOString(),
        items: mr.details.map((d) => {
          const itemResult: any = {
            id: d.id,
            barcode: d.barcode,
            inventory_no: d.inventoryNo,
            inventory_name: d.inventoryName,
            qty: d.qty,
            uom_name: d.uomName || 'Pcs',
            description: d.description || '',
          };
          // Mask unit price and subtotal if user has no HPP permission
          if (authUser.hasHpp) {
            itemResult.unit_price = d.unitPrice;
            itemResult.subtotal = d.subtotal;
          }
          return itemResult;
        }),
      };

      // Mask financial totals if user has no HPP permission
      if (authUser.hasHpp) {
        result.down_payment = mr.downPayment || 0;
        result.disc_percentage = mr.discPercentage || 0;
        result.ppn_percentage = mr.ppnPercentage || 0;
        result.subtotal = mr.subtotal || 0;
        result.tax = mr.tax || 0;
        result.grand_total = mr.grandTotal || 0;
      }

      return result;
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/priced:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
