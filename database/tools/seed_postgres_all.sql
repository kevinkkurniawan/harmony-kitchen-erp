CREATE TABLE IF NOT EXISTS m_supplier (
    id INT PRIMARY KEY,
    supplier_no VARCHAR(100),
    supplier_name VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    phone1 VARCHAR(100),
    phone2 VARCHAR(100),
    fax VARCHAR(100),
    contact_person VARCHAR(100),
    email VARCHAR(100),
    tax_no VARCHAR(100),
    is_taxable BOOLEAN,
    description TEXT
);
TRUNCATE TABLE m_supplier;
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (1, 'S00001', '-', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (2, '1', 'PT. Multimegah Indahjaya (Muliya)', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (3, '2', 'Maspion Group', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (4, '3', 'Sealion', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (5, '4', 'RRAL', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (6, 'S00001', 'OTC', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (7, 'S00001', 'CV. Kitajaya (SUPRA)', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (8, 'S00001', 'ETC', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (9, 'S00001', 'PT. Rama Makmur Sentosa (Akebonno)', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (10, 'S00001', 'PT. Timur Jaya Sentosa', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (11, 'S00001', 'PT. Presindo Central', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (12, 'S00001', 'Kedaung Group', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (13, 'S00001', 'ARJ', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (14, 'S00001', 'Delfiro', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (15, 'S00001', 'NUMAN', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (16, 'S00001', 'CCM', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (17, 'S00001', 'UKB', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (18, 'S00001', 'Hoze Ware', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (19, 'S00001', 'MJ Distribution', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (20, 'S00001', 'WRG', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (21, 'S00001', 'MMS', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (22, 'S00001', 'CV. Semeru Abadi', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (23, 'S00001', ' CV. Kasih Anugrah', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (24, 'S00001', 'MIYAKO', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (25, 'S00001', 'MSR', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (26, 'S00001', 'PT. Kedawung Setia', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (27, 'S00001', 'PT. Srithai Maspion', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (28, 'S00001', 'PT. Altindo Mulia', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (29, 'S00001', 'LC', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (30, 'S00001', 'WIJAYA (WIJ)', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (31, 'S00001', 'Keramindo', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (32, 'S00001', 'TANICA', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (33, 'S00001', 'SJB', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (34, 'S00001', 'Mehaa', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (35, 'S00001', 'GLM', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (36, 'S00001', 'BOLDE', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (37, 'S00001', 'PT. Royal Sultan Agung', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (38, 'S00001', 'PT. Naga Komodo', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (39, 'S00001', 'ABS', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (40, 'S00001', 'WINSTON', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (41, 'S00001', 'IPN', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (42, 'S00001', 'Fajar Timur', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (43, 'S00001', 'SGB', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (44, 'S00001', 'RKM', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (45, 'S00001', 'Paramount', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (46, 'S00001', 'CKU', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (47, 'S00001', 'Trisensa', '-', '', '-', '-', '', '', '', '', FALSE, '');
INSERT INTO m_supplier (id, supplier_no, supplier_name, address, city, phone1, phone2, fax, contact_person, email, tax_no, is_taxable, description) VALUES (48, 'S00001', 'Rajawali', '-', '', '-', '-', '', '', '', '', FALSE, '');
CREATE TABLE IF NOT EXISTS m_promo_group (
    id INT PRIMARY KEY,
    promo_code VARCHAR(100),
    promo_name VARCHAR(255),
    description TEXT,
    is_active BOOLEAN
);
TRUNCATE TABLE m_promo_group;
INSERT INTO m_promo_group (id, promo_code, promo_name, description, is_active) VALUES (1, 'PRM-GR1', 'Promo Grosir Dapur Utama', 'Discount bertingkat pembelian grosir', TRUE);
INSERT INTO m_promo_group (id, promo_code, promo_name, description, is_active) VALUES (2, 'PRM-BUNDLE', 'Promo Bundle Parcel', 'Paket hemat parcel dapur', TRUE);
