using System;
using System.Data.SqlClient;
using System.IO;
using System.Text;

public class Program {
    public static void Main() {
        string connStrStr = "Data Source=127.0.0.1,1433;Initial Catalog=db_MC_Harmony;User ID=sa;Password=adm1nPassword!;Encrypt=False;TrustServerCertificate=True";
        using (SqlConnection conn = new SqlConnection(connStrStr)) {
            conn.Open();
            using (SqlCommand cmd = new SqlCommand("SELECT ID, Barcode, InventoryNo, InventoryName, ISNULL(InventoryBrandID,0), ISNULL(InventoryCategoryID,0), ISNULL(InventoryProductID,0), ISNULL(UoMID,0), ISNULL(MinStock,0), ISNULL(MaxStock,0), ISNULL(KodeHarga,''), ISNULL(Description,''), ISNULL(Price,0), ISNULL(Disc,0), ISNULL(isActive,1), ISNULL(HPP,0), ISNULL(PriceBuy,0), ISNULL(Grosir1,0), ISNULL(Grosir2,0), ISNULL(Grosir3,0), ISNULL(StokAwal,0), ISNULL(StokUpdate,0) FROM M_Inventory", conn)) {
                using (SqlDataReader reader = cmd.ExecuteReader()) {
                    using (StreamWriter sw = new StreamWriter("seed_postgres_inventory_v2.sql", false, Encoding.UTF8)) {
                        sw.WriteLine("CREATE TABLE IF NOT EXISTS m_inventory (");
                        sw.WriteLine("    id INT PRIMARY KEY,");
                        sw.WriteLine("    barcode VARCHAR(100),");
                        sw.WriteLine("    inventory_no VARCHAR(100),");
                        sw.WriteLine("    inventory_name VARCHAR(255),");
                        sw.WriteLine("    inventory_brand_id INT,");
                        sw.WriteLine("    inventory_category_id INT,");
                        sw.WriteLine("    inventory_product_id INT,");
                        sw.WriteLine("    uom_id INT,");
                        sw.WriteLine("    min_stock INT,");
                        sw.WriteLine("    max_stock INT,");
                        sw.WriteLine("    kode_harga VARCHAR(255),");
                        sw.WriteLine("    description TEXT,");
                        sw.WriteLine("    price NUMERIC(18,2),");
                        sw.WriteLine("    disc NUMERIC(18,2),");
                        sw.WriteLine("    is_active BOOLEAN,");
                        sw.WriteLine("    hpp NUMERIC(18,2),");
                        sw.WriteLine("    price_buy NUMERIC(18,2),");
                        sw.WriteLine("    grosir1 NUMERIC(18,2),");
                        sw.WriteLine("    grosir2 NUMERIC(18,2),");
                        sw.WriteLine("    grosir3 NUMERIC(18,2),");
                        sw.WriteLine("    stok_awal INT,");
                        sw.WriteLine("    stok_update INT");
                        sw.WriteLine(");");
                        sw.WriteLine("TRUNCATE TABLE m_inventory;");

                        while (reader.Read()) {
                            int id = reader.GetInt32(0);
                            string barcode = (reader.GetValue(1) ?? "").ToString().Replace("'", "''").Replace("\r", "").Replace("\n", " ");
                            string invNo = (reader.GetValue(2) ?? "").ToString().Replace("'", "''").Replace("\r", "").Replace("\n", " ");
                            string invName = (reader.GetValue(3) ?? "").ToString().Replace("'", "''").Replace("\r", "").Replace("\n", " ");
                            int brandId = Convert.ToInt32(reader.GetValue(4));
                            int catId = Convert.ToInt32(reader.GetValue(5));
                            int prodId = Convert.ToInt32(reader.GetValue(6));
                            int uomId = Convert.ToInt32(reader.GetValue(7));
                            int minStock = Convert.ToInt32(reader.GetValue(8));
                            int maxStock = Convert.ToInt32(reader.GetValue(9));
                            string kodeHarga = (reader.GetValue(10) ?? "").ToString().Replace("'", "''").Replace("\r", "").Replace("\n", " ");
                            string desc = (reader.GetValue(11) ?? "").ToString().Replace("'", "''").Replace("\r", "").Replace("\n", " ");
                            decimal price = Convert.ToDecimal(reader.GetValue(12));
                            decimal disc = Convert.ToDecimal(reader.GetValue(13));
                            bool isActive = Convert.ToBoolean(reader.GetValue(14));
                            decimal hpp = Convert.ToDecimal(reader.GetValue(15));
                            decimal priceBuy = Convert.ToDecimal(reader.GetValue(16));
                            decimal grosir1 = Convert.ToDecimal(reader.GetValue(17));
                            decimal grosir2 = Convert.ToDecimal(reader.GetValue(18));
                            decimal grosir3 = Convert.ToDecimal(reader.GetValue(19));
                            int stokAwal = Convert.ToInt32(reader.GetValue(20));
                            int stokUpdate = Convert.ToInt32(reader.GetValue(21));

                            sw.WriteLine(string.Format(
                                "INSERT INTO m_inventory (id, barcode, inventory_no, inventory_name, inventory_brand_id, inventory_category_id, inventory_product_id, uom_id, min_stock, max_stock, kode_harga, description, price, disc, is_active, hpp, price_buy, grosir1, grosir2, grosir3, stok_awal, stok_update) VALUES ({0}, '{1}', '{2}', '{3}', {4}, {5}, {6}, {7}, {8}, {9}, '{10}', '{11}', {12}, {13}, {14}, {15}, {16}, {17}, {18}, {19}, {20}, {21});",
                                id, barcode, invNo, invName, brandId, catId, prodId, uomId, minStock, maxStock, kodeHarga, desc, price, disc, isActive ? "TRUE" : "FALSE", hpp, priceBuy, grosir1, grosir2, grosir3, stokAwal, stokUpdate
                            ));
                        }
                    }
                }
            }
        }
    }
}
