-- 1. Wholesale Category
CREATE TABLE IF NOT EXISTS m_wholesalecategory (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    isactive BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    tier1_minqty INT DEFAULT 0,
    tier2_minqty INT DEFAULT 0,
    tier3_minqty INT DEFAULT 0,
    createduser VARCHAR(100),
    createddate TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    modifieduser VARCHAR(100),
    modifieddate TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    rowguid UUID DEFAULT uuid_generate_v4()
);

-- Add wholesalecategoryid to m_inventory
ALTER TABLE m_inventory ADD COLUMN IF NOT EXISTS wholesalecategoryid INT;

-- 2. Stock Opname Header & Detail
CREATE TABLE IF NOT EXISTS t_opnameheader (
    id BIGSERIAL PRIMARY KEY,
    notransaction VARCHAR(100) UNIQUE NOT NULL,
    opnamedate TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    whid INT,
    status VARCHAR(20) DEFAULT 'DRAFT',
    notes TEXT,
    createduser VARCHAR(100),
    createddate TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    posteduser VARCHAR(100),
    posteddate TIMESTAMPTZ(6),
    reverseduser VARCHAR(100),
    reverseddate TIMESTAMPTZ(6),
    reversedreason TEXT,
    idempotencykey VARCHAR(100) UNIQUE,
    rowguid UUID DEFAULT uuid_generate_v4()
);

CREATE TABLE IF NOT EXISTS t_opnamedetail (
    id BIGSERIAL PRIMARY KEY,
    notransaction VARCHAR(100) NOT NULL,
    inventoryid INT NOT NULL,
    barcode VARCHAR(100),
    systemqty DECIMAL DEFAULT 0,
    physicalqty DECIMAL DEFAULT 0,
    differenceqty DECIMAL DEFAULT 0,
    unitprice DECIMAL DEFAULT 0,
    notes TEXT,
    rowguid UUID DEFAULT uuid_generate_v4()
);
CREATE INDEX IF NOT EXISTS idx_opnamedetail_notransaction ON t_opnamedetail(notransaction);

-- 3. Sales Header and Detail extensions
ALTER TABLE t_salesposheader ADD COLUMN IF NOT EXISTS isoverridegrosir BOOLEAN DEFAULT FALSE;
ALTER TABLE t_salesposheader ADD COLUMN IF NOT EXISTS manualdiscountmode VARCHAR(20);
ALTER TABLE t_salesposheader ADD COLUMN IF NOT EXISTS manualdiscountvalue DECIMAL DEFAULT 0;
ALTER TABLE t_salesposheader ADD COLUMN IF NOT EXISTS manualdiscountamount DECIMAL DEFAULT 0;
ALTER TABLE t_salesposheader ADD COLUMN IF NOT EXISTS manualdiscountreason TEXT;
ALTER TABLE t_salesposheader ADD COLUMN IF NOT EXISTS manualdiscountuser VARCHAR(100);
ALTER TABLE t_salesposheader ADD COLUMN IF NOT EXISTS paymenttypecode VARCHAR(50);

ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS unithpp DECIMAL DEFAULT 0;
ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS totalhpp DECIMAL DEFAULT 0;
ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS hppprovenance VARCHAR(20) DEFAULT 'EXACT';
ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS pricesource VARCHAR(50) DEFAULT 'RETAIL';
ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS wholesalecategoryid INT;
ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS wholesaleversion INT;
ALTER TABLE t_salesposdetail ADD COLUMN IF NOT EXISTS wholesaletier INT;

-- 4. Audit Event table
CREATE TABLE IF NOT EXISTS t_auditevent (
    id BIGSERIAL PRIMARY KEY,
    eventtype VARCHAR(50) NOT NULL,
    entitytype VARCHAR(50) NOT NULL,
    entityid VARCHAR(100) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    actiondate TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    beforedata JSONB,
    afterdata JSONB,
    idempotencykey VARCHAR(100) UNIQUE,
    rowguid UUID DEFAULT uuid_generate_v4()
);
CREATE INDEX IF NOT EXISTS idx_auditevent_entity ON t_auditevent(entitytype, entityid);
CREATE INDEX IF NOT EXISTS idx_auditevent_actiondate ON t_auditevent(actiondate);

-- 5. User Capability table
CREATE TABLE IF NOT EXISTS t_usercapability (
    id SERIAL PRIMARY KEY,
    userid INT NOT NULL,
    capabilitycode VARCHAR(100) NOT NULL,
    isgranted BOOLEAN DEFAULT TRUE,
    grantedby VARCHAR(100),
    granteddate TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    rowguid UUID DEFAULT uuid_generate_v4(),
    CONSTRAINT idx_user_capability UNIQUE (userid, capabilitycode)
);
