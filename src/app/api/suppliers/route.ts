import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureSupplierTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS m_supplier (
      id SERIAL PRIMARY KEY,
      supplier_no VARCHAR(100),
      supplier_name VARCHAR(255) NOT NULL,
      address TEXT,
      city VARCHAR(100),
      phone1 VARCHAR(100),
      phone2 VARCHAR(100),
      fax VARCHAR(100),
      contact_person VARCHAR(100),
      email VARCHAR(100),
      tax_no VARCHAR(100),
      is_taxable BOOLEAN DEFAULT FALSE,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE
    );
    ALTER TABLE m_supplier ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    CREATE SEQUENCE IF NOT EXISTS m_supplier_id_seq;
    ALTER TABLE m_supplier ALTER COLUMN id SET DEFAULT nextval('m_supplier_id_seq');
  `);

  // Seed rich realistic suppliers if count is less than 15
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM m_supplier;`);
  if (countRes.rows[0].count < 15) {
    await pool.query(`TRUNCATE TABLE m_supplier RESTART IDENTITY;`);
    await pool.query(`
      INSERT INTO m_supplier (supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description, is_active) VALUES
      ('SUP-001', 'PT. Maspion Group Indonesia', 'Jl. Kembang Jepun No. 38', 'Surabaya', '031-3531445', '0811-345-889', '031-3531446', 'Bpk. Herman Maspion', 'sales@maspion.co.id', '01.234.567.8-603.000', TRUE, 'Supplier Utama Wajan, Panci, Cookware Anti Lengket', TRUE),
      ('SUP-002', 'PT. RKM Kitchenware Industries', 'Kawasan Industri Rungkut Industri II No. 15', 'Surabaya', '031-8439900', '0812-9988-771', '031-8439901', 'Ibu Melia RKM', 'info@rkm-kitchen.com', '02.345.678.9-604.000', TRUE, 'Produsen Utama Perlengkapan Dapur Stainless Steel', TRUE),
      ('SUP-003', 'PT. Paramount Kitchen Solutions', 'Jl. Daan Mogot KM 18 No. 5', 'Jakarta Barat', '021-5438810', '0813-1122-334', '021-5438811', 'Bpk. David Paramount', 'contact@paramount-kitchen.co.id', '03.456.789.0-015.000', TRUE, 'Supplier Alat Masak Profesional & Kompor Restoran', TRUE),
      ('SUP-004', 'PT. Presindo Central Utamaindo', 'Jl. Gatot Subroto No. 120', 'Bandung', '022-7301122', '0815-6677-889', '022-7301123', 'Bpk. Anton Presindo', 'sales@presindo-central.com', '04.567.890.1-423.000', TRUE, 'Supplier Piring Saji Keramik Opal & Dining Set', TRUE),
      ('SUP-005', 'PT. Timur Jaya Sentosa Kitchen', 'Jl. Basuki Rahmat No. 75', 'Surabaya', '031-5320099', '0818-4455-667', '031-5320098', 'Ibu Kartika TimurJaya', 'support@timurjaya.co.id', '05.678.901.2-605.000', TRUE, 'Distributor Kompor Gas Heavy Duty Resto & Oven', TRUE),
      ('SUP-006', 'CV. CKU Utamajaya Stainless', 'Kawasan Pergudangan Margomulyo Permai Blok C-12', 'Surabaya', '031-7495566', '0857-1122-3344', '', 'Bpk. Budi CKU', 'ckustainless@gmail.com', '06.789.012.3-606.000', FALSE, 'Pabrikan Sendok Garpu Stainless & Cutlery', TRUE),
      ('SUP-007', 'PT. Trisensa Ceramics Indonesia', 'Jl. Raya Cikarang-Cibarusah KM 5', 'Bekasi', '021-8970011', '0819-0011-223', '021-8970012', 'Ibu Siska Trisensa', 'marketing@trisensa-ceramics.com', '07.890.123.4-054.000', TRUE, 'Produsen Mangkok & Piring Keramik Hotel Catering', TRUE),
      ('SUP-008', 'PT. Rajawali Kitchenware Semarang', 'Jl. Supriyadi No. 45', 'Semarang', '024-6723344', '0812-3344-556', '024-6723345', 'Bpk. Eko Rajawali', 'rajawalikitchen@yahoo.com', '08.901.234.5-503.000', TRUE, 'Supplier Wok Pan, Grill Pan, Cast Iron Skillet', TRUE),
      ('SUP-009', 'CV. Dapur Utama Perkasa', 'Jl. Diponegoro No. 88', 'Malang', '0341-366778', '0821-4455-667', '', 'Bpk. Agus DapurUtama', 'dapurutamaperkasa@gmail.com', '', FALSE, 'Distributor Pisau Dapur Set & Talenan Kayu', TRUE),
      ('SUP-010', 'PT. Miyako Electronic & Appliances', 'Jl. Gajah Mada No. 210', 'Jakarta Barat', '021-6345577', '0811-9900-112', '021-6345578', 'Ibu Ratna Miyako', 'service@miyako.co.id', '09.012.345.6-016.000', TRUE, 'Supplier Rice Cooker, Blender, Blender Heavy Duty Resto', TRUE),
      ('SUP-011', 'PT. Cosmos Indonesia Hardware', 'Jl. Daan Mogot KM 10 No. 12', 'Jakarta Barat', '021-5801122', '0813-8899-001', '021-5801123', 'Bpk. Denny Cosmos', 'sales@cosmos.co.id', '10.123.456.7-017.000', TRUE, 'Supplier Peralatan Listrik Dapur & Air Fryer', TRUE),
      ('SUP-012', 'CV. Solo Kitchenware Center', 'Jl. Slamet Riyadi No. 150', 'Surakarta', '0271-645566', '0856-4433-221', '', 'Bpk. Joko Solo', 'solokitchencenter@gmail.com', '', FALSE, 'Supplier Perlengkapan Dapur Tradisional & Bakaran', TRUE),
      ('SUP-013', 'PT. Bali Hotel & Kitchen Equipment', 'Jl. Sunset Road No. 88X', 'Badung (Bali)', '0361-755443', '0812-3677-889', '0361-755444', 'Ibu Putu BaliKitchen', 'info@balikitchenequipment.com', '11.234.567.8-901.000', TRUE, 'Supplier Alat Dapur Hotel Bintang & Resort Bali', TRUE),
      ('SUP-014', 'PT. Modena Indonesia Appliance', 'Jl. Suryopranoto No. 2', 'Jakarta Pusat', '021-3860088', '0811-1234-567', '021-3860089', 'Bpk. Michael Modena', 'modena@modena.co.id', '12.345.678.9-071.000', TRUE, 'Supplier Exhaust Hood, Cooker Hood & Stove Resto', TRUE),
      ('SUP-015', 'CV. Jogja Cookware Nusantara', 'Jl. Magelang KM 6 No. 45', 'Yogyakarta', '0274-566778', '0817-8899-001', '', 'Bpk. Tri JogjaCookware', 'jogjacookware@gmail.com', '', FALSE, 'Supplier Cobek Batu Alam & Peralatan Masak Tradisional', TRUE);
    `);
  }
}

export async function GET(request: Request) {
  try {
    await ensureSupplierTableExists();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const onlyTaxable = searchParams.get('onlyTaxable') === 'true';

    let queryText = `
      SELECT 
        id::text AS id,
        supplier_no AS "supplierNo",
        supplier_name AS "supplierName",
        address,
        city,
        phone1,
        phone2,
        fax,
        contact_person AS "contactPerson",
        email,
        tax_no AS "taxNo",
        COALESCE(is_taxable, false) AS "isTaxable",
        description,
        COALESCE(is_active, true) AS "isActive"
      FROM m_supplier
    `;

    const whereConditions: string[] = [];
    const values: (string | boolean)[] = [];

    if (q) {
      values.push(`%${q}%`);
      whereConditions.push(`(
        supplier_name ILIKE $${values.length} OR 
        supplier_no ILIKE $${values.length} OR 
        city ILIKE $${values.length} OR 
        contact_person ILIKE $${values.length} OR
        phone1 ILIKE $${values.length}
      )`);
    }

    if (onlyActive) {
      whereConditions.push(`(is_active = TRUE OR is_active IS NULL)`);
    }

    if (onlyTaxable) {
      whereConditions.push(`is_taxable = TRUE`);
    }

    if (whereConditions.length > 0) {
      queryText += ` WHERE ` + whereConditions.join(' AND ');
    }

    queryText += ` ORDER BY id ASC;`;

    const result = await pool.query(queryText, values);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSupplierTableExists();
    const body = await request.json();
    const {
      supplierNo,
      supplierName,
      address = '',
      city = '',
      phone1 = '',
      phone2 = '',
      fax = '',
      contactPerson = '',
      email = '',
      taxNo = '',
      isTaxable = false,
      description = '',
      isActive = true,
    } = body;

    if (!supplierName) {
      return NextResponse.json({ success: false, error: 'Nama supplier wajib diisi' }, { status: 400 });
    }

    const code = supplierNo || `SUP-${Date.now().toString().slice(-5)}`;

    const insertQuery = `
      INSERT INTO m_supplier (
        supplier_no, supplier_name, address, city, phone1, phone2,
        fax, contact_person, email, tax_no, is_taxable, description, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING id;
    `;

    const values = [
      code,
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
    ];

    const result = await pool.query(insertQuery, values);
    return NextResponse.json({ success: true, message: 'Supplier berhasil ditambahkan', id: result.rows[0].id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
