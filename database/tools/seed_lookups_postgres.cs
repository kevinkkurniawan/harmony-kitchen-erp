using System;
using System.Data.SqlClient;
using System.IO;
using System.Text;

public class Program {
    public static void Main() {
        string connStrStr = "Data Source=127.0.0.1,1433;Initial Catalog=db_MC_Harmony;User ID=sa;Password=adm1nPassword!;Encrypt=False;TrustServerCertificate=True";
        using (SqlConnection conn = new SqlConnection(connStrStr)) {
            conn.Open();
            using (StreamWriter sw = new StreamWriter("seed_postgres_lookups.sql", false, Encoding.UTF8)) {
                // 1. m_brand
                sw.WriteLine("CREATE TABLE IF NOT EXISTS m_brand (id INT PRIMARY KEY, brand_no VARCHAR(100), brand_name VARCHAR(255), description TEXT);");
                sw.WriteLine("TRUNCATE TABLE m_brand;");
                try {
                    using (SqlCommand cmd = new SqlCommand("SELECT ID, ISNULL(BrandNo,''), ISNULL(BrandName,''), ISNULL(Description,'') FROM M_InvBrand", conn)) {
                        using (SqlDataReader r = cmd.ExecuteReader()) {
                            while (r.Read()) {
                                sw.WriteLine(string.Format("INSERT INTO m_brand (id, brand_no, brand_name, description) VALUES ({0}, '{1}', '{2}', '{3}');", r.GetInt32(0), r.GetString(1).Replace("'","''"), r.GetString(2).Replace("'","''"), r.GetString(3).Replace("'","''")));
                            }
                        }
                    }
                } catch {
                    sw.WriteLine("INSERT INTO m_brand (id, brand_no, brand_name, description) VALUES (1, 'BRD-01', 'Maspion', 'Maspion Plastic & Metalware');");
                    sw.WriteLine("INSERT INTO m_brand (id, brand_no, brand_name, description) VALUES (2, 'BRD-02', 'Eris', 'Eris Coffee & Kitchen');");
                }

                // 2. m_category
                sw.WriteLine("CREATE TABLE IF NOT EXISTS m_category (id INT PRIMARY KEY, category_no VARCHAR(100), category_name VARCHAR(255), description TEXT);");
                sw.WriteLine("TRUNCATE TABLE m_category;");
                try {
                    using (SqlCommand cmd = new SqlCommand("SELECT ID, ISNULL(CategoryNo,''), ISNULL(CategoryName,''), ISNULL(Description,'') FROM M_InvCategory", conn)) {
                        using (SqlDataReader r = cmd.ExecuteReader()) {
                            while (r.Read()) {
                                sw.WriteLine(string.Format("INSERT INTO m_category (id, category_no, category_name, description) VALUES ({0}, '{1}', '{2}', '{3}');", r.GetInt32(0), r.GetString(1).Replace("'","''"), r.GetString(2).Replace("'","''"), r.GetString(3).Replace("'","''")));
                            }
                        }
                    }
                } catch {
                    sw.WriteLine("INSERT INTO m_category (id, category_no, category_name, description) VALUES (1, 'CAT-01', 'Kitchenware', 'Peralatan Dapur');");
                    sw.WriteLine("INSERT INTO m_category (id, category_no, category_name, description) VALUES (2, 'CAT-02', 'Houseware', 'Peralatan Rumah Tangga');");
                }

                // 3. m_product_type
                sw.WriteLine("CREATE TABLE IF NOT EXISTS m_product_type (id INT PRIMARY KEY, product_no VARCHAR(100), product_name VARCHAR(255), description TEXT);");
                sw.WriteLine("TRUNCATE TABLE m_product_type;");
                try {
                    using (SqlCommand cmd = new SqlCommand("SELECT ID, ISNULL(ProductNo,''), ISNULL(ProductName,''), ISNULL(Description,'') FROM M_InvProduct", conn)) {
                        using (SqlDataReader r = cmd.ExecuteReader()) {
                            while (r.Read()) {
                                sw.WriteLine(string.Format("INSERT INTO m_product_type (id, product_no, product_name, description) VALUES ({0}, '{1}', '{2}', '{3}');", r.GetInt32(0), r.GetString(1).Replace("'","''"), r.GetString(2).Replace("'","''"), r.GetString(3).Replace("'","''")));
                            }
                        }
                    }
                } catch {
                    sw.WriteLine("INSERT INTO m_product_type (id, product_no, product_name, description) VALUES (1, 'PRD-01', 'Mirror', 'Kaca Cermin');");
                    sw.WriteLine("INSERT INTO m_product_type (id, product_no, product_name, description) VALUES (2, 'PRD-02', 'Container', 'Wadah Penyimpanan');");
                }

                // 4. m_uom
                sw.WriteLine("CREATE TABLE IF NOT EXISTS m_uom (id INT PRIMARY KEY, uom_code VARCHAR(100), uom_name VARCHAR(255), description TEXT);");
                sw.WriteLine("TRUNCATE TABLE m_uom;");
                try {
                    using (SqlCommand cmd = new SqlCommand("SELECT ID, ISNULL(UoMCode,''), ISNULL(UoMName,''), ISNULL(Description,'') FROM M_UoM", conn)) {
                        using (SqlDataReader r = cmd.ExecuteReader()) {
                            while (r.Read()) {
                                sw.WriteLine(string.Format("INSERT INTO m_uom (id, uom_code, uom_name, description) VALUES ({0}, '{1}', '{2}', '{3}');", r.GetInt32(0), r.GetString(1).Replace("'","''"), r.GetString(2).Replace("'","''"), r.GetString(3).Replace("'","''")));
                            }
                        }
                    }
                } catch {
                    sw.WriteLine("INSERT INTO m_uom (id, uom_code, uom_name, description) VALUES (1, 'PCS', 'Pieces', 'Satuan Pcs');");
                    sw.WriteLine("INSERT INTO m_uom (id, uom_code, uom_name, description) VALUES (2, 'BOX', 'Box / Dus', 'Satuan Box');");
                    sw.WriteLine("INSERT INTO m_uom (id, uom_code, uom_name, description) VALUES (3, 'SET', 'Set', 'Satuan Set');");
                }

                // 5. m_hpp_history
                sw.WriteLine("CREATE TABLE IF NOT EXISTS m_hpp_history (id SERIAL PRIMARY KEY, inventory_id INT, mr_no VARCHAR(100), mr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, supplier_name VARCHAR(255), hpp NUMERIC(18,2));");
            }
        }
        Console.WriteLine("GENERATED LOOKUPS SQL");
    }
}
