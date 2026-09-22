import { prisma } from '../src/lib/db';

/**
 * Migration script to backfill legacy HPP data in t_salesposdetail.
 * 
 * Classification rules:
 * 1. Rows where unithpp > 0 or totalhpp > 0 => EXACT
 * 2. Rows where hppprovenance IS NULL and m_inventory.hpp > 0 => ESTIMATED (with unithpp = m_inventory.hpp, totalhpp = m_inventory.hpp * qty)
 * 3. Remaining unclassified rows => UNAVAILABLE (with unithpp = 0, totalhpp = 0)
 */
async function migrateLegacyHpp() {
  console.log('--- Starting Legacy HPP Migration ---');

  try {
    // 1. Ensure columns exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS unithpp DECIMAL;
      ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS totalhpp DECIMAL;
      ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS hppprovenance VARCHAR(20);
    `);
    console.log('[1/4] Columns verified.');

    // 2. Classify EXACT
    const exactCount = await prisma.$executeRawUnsafe(`
      UPDATE t_salesposdetail
      SET hppprovenance = 'EXACT'
      WHERE hppprovenance IS NULL
        AND ((unithpp IS NOT NULL AND unithpp > 0) OR (totalhpp IS NOT NULL AND totalhpp > 0));
    `);
    console.log(`[2/4] Backfilled ${exactCount} rows as EXACT.`);

    // 3. Classify ESTIMATED from master inventory
    const estimatedCount = await prisma.$executeRawUnsafe(`
      UPDATE t_salesposdetail d
      SET unithpp = COALESCE(d.unithpp, i.hpp, 0),
          totalhpp = COALESCE(d.totalhpp, (COALESCE(i.hpp, 0) * COALESCE(d.qty, 1)), 0),
          hppprovenance = 'ESTIMATED'
      FROM m_inventory i
      WHERE d.inventoryid = i.id
        AND d.hppprovenance IS NULL
        AND i.hpp IS NOT NULL
        AND i.hpp > 0;
    `);
    console.log(`[3/4] Backfilled ${estimatedCount} rows as ESTIMATED.`);

    // 4. Classify UNAVAILABLE
    const unavailableCount = await prisma.$executeRawUnsafe(`
      UPDATE t_salesposdetail
      SET unithpp = COALESCE(unithpp, 0),
          totalhpp = COALESCE(totalhpp, 0),
          hppprovenance = 'UNAVAILABLE'
      WHERE hppprovenance IS NULL;
    `);
    console.log(`[4/4] Backfilled ${unavailableCount} rows as UNAVAILABLE.`);

    // 5. Set defaults
    await prisma.$executeRawUnsafe(`
      ALTER TABLE t_salesposdetail ALTER COLUMN unithpp SET DEFAULT 0;
      ALTER TABLE t_salesposdetail ALTER COLUMN totalhpp SET DEFAULT 0;
      ALTER TABLE t_salesposdetail ALTER COLUMN hppprovenance SET DEFAULT 'EXACT';
    `);
    console.log('Defaults set for future rows. Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateLegacyHpp();
