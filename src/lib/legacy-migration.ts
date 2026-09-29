import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { SENSITIVE_CAPABILITIES } from '@/lib/capabilities';

export async function runLegacyDataMigration() {
  const results = {
    wholesaleCategoryCreated: false,
    inventoryUpdated: 0,
    salesDetailsClassified: 0,
    adminCapabilitiesGranted: 0,
  };

  // 1. Ensure Default Wholesale Category exists
  let defaultCategory = await prisma.m_wholesalecategory.findFirst({
    where: { code: 'DEFAULT' },
  });

  if (!defaultCategory) {
    defaultCategory = await prisma.m_wholesalecategory.create({
      data: {
        code: 'DEFAULT',
        name: 'Kategori Grosir Default',
        description: 'Default wholesale category with 3 tiers',
        isactive: true,
        version: 1,
        tier1_minqty: 12,
        tier2_minqty: 60,
        tier3_minqty: 120,
        createduser: 'system',
      },
    });
    results.wholesaleCategoryCreated = true;
  }

  // 2. Assign default wholesale category to items without category
  if (defaultCategory) {
    const updated = await prisma.m_inventory.updateMany({
      where: { wholesalecategoryid: null },
      data: { wholesalecategoryid: defaultCategory.id },
    });
    results.inventoryUpdated = updated.count;
  }

  // 3. Classify historical sales details HPP
  // For unclassified details:
  // - If item has HPP > 0: set unithpp = item.hpp, totalhpp = unithpp * qty, hppprovenance = 'ESTIMATED'
  // - If item has no HPP or HPP <= 0: set hppprovenance = 'UNAVAILABLE'
  try {
    const classifiedEstimated = await prisma.$executeRaw(Prisma.sql`
      UPDATE t_salesposdetail d
      SET unithpp = COALESCE(i.hpp, 0),
          totalhpp = COALESCE(i.hpp, 0) * d.qty,
          hppprovenance = 'ESTIMATED'
      FROM m_inventory i
      WHERE d.inventoryid = i.id
        AND (d.hppprovenance IS NULL OR d.hppprovenance = '')
        AND COALESCE(i.hpp, 0) > 0
    `);

    const classifiedUnavailable = await prisma.$executeRaw(Prisma.sql`
      UPDATE t_salesposdetail d
      SET unithpp = 0,
          totalhpp = 0,
          hppprovenance = 'UNAVAILABLE'
      FROM m_inventory i
      WHERE d.inventoryid = i.id
        AND (d.hppprovenance IS NULL OR d.hppprovenance = '')
        AND COALESCE(i.hpp, 0) <= 0
    `);

    results.salesDetailsClassified = classifiedEstimated + classifiedUnavailable;
  } catch (e) {
    console.error('Error classifying sales detail HPP:', e);
  }

  // 4. Grant all capabilities to Admin users
  try {
    const adminUsers = await prisma.m_user.findMany({
      where: {
        username: {
          contains: 'admin',
          mode: 'insensitive',
        },
      },
    });

    for (const admin of adminUsers) {
      for (const cap of SENSITIVE_CAPABILITIES) {
        await prisma.t_usercapability.upsert({
          where: {
            userid_capabilitycode: {
              userid: Number(admin.id),
              capabilitycode: cap.code,
            },
          },
          update: { isgranted: true },
          create: {
            userid: Number(admin.id),
            capabilitycode: cap.code,
            isgranted: true,
            grantedby: 'system_migration',
          },
        });
        results.adminCapabilitiesGranted++;
      }
    }
  } catch (e) {
    console.error('Error granting admin capabilities:', e);
  }

  return results;
}
