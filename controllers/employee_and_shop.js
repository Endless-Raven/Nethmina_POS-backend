const db = require("../config/db");

const getAllShopsAndEmployees = async (req, res) => {
  try {
    const [shops] = await db.query(`
        SELECT store_id, store_name, store_address, store_phone_number FROM stores
      `);

    const [employees] = await db.query(`
        SELECT user_id, username, role, user_phone_number AS phone, store_id FROM users
      `);

    const shopList = shops.map((shop) => ({
      store_name: shop.store_name,
      store_id: shop.store_id,
    }));

    const shopData = shops.map((shop) => ({
      ...shop,
      employees: employees.filter((emp) => emp.store_id === shop.store_id),
    }));

    res.json({ shop_list: shopList, shop_data: shopData });
  } catch (err) {
    console.error("Error fetching shops and employees:", err.message);
    res.status(500).json({ message: "Error inside server", err });
  }
};

module.exports = {
  getAllShopsAndEmployees,
};
