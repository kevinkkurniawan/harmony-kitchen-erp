import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/harmony_erp?schema=public',
  });
  await client.connect();
  try {
    const rawSql = fs.readFileSync(path.join(__dirname, 'migrations/manual_migration.sql'), 'utf8');
    console.log('Applying migration with pg...');
    await client.query(rawSql);
    console.log('Migration applied successfully!');

    // Verify columns
    const headerCols = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 't_sales_pos_header' ORDER BY column_name;
    `);
    console.log('t_sales_pos_header columns:', headerCols.rows.map(r => r.column_name));

    const detailCols = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 't_sales_pos_detail' ORDER BY column_name;
    `);
    console.log('t_sales_pos_detail columns:', detailCols.rows.map(r => r.column_name));

    const sessionCols = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 't_auth_session' ORDER BY column_name;
    `);
    console.log('t_auth_session columns:', sessionCols.rows.map(r => r.column_name));

    const grantCols = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 't_user_grant' ORDER BY column_name;
    `);
    console.log('t_user_grant columns:', grantCols.rows.map(r => r.column_name));

  } catch (err: any) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}

main();
