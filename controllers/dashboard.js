const db = require("../config/db");

const getDashboardData = async (req, res) => {
  try {
    // Monthly sales query
    const [monthlySalesData] = await db.query(`
      SELECT SUM(total_amount) AS monthly_sales
      FROM sales
      WHERE MONTH(sale_date) = MONTH(CURRENT_DATE)
        AND YEAR(sale_date) = YEAR(CURRENT_DATE);
    `);

    // Daily sales query (for today's sales)
    const [dailySalesData] = await db.query(`
      SELECT SUM(total_amount) AS daily_sales
      FROM sales
      WHERE DATE(sale_date) = CURRENT_DATE();
    `);

    // Fetching top 5 products by sales
    const [topSalesData] = await db.query(`
      SELECT p.product_name AS name,
             (SUM(s.total_amount) / (SELECT SUM(total_amount) FROM sales) * 100) AS percentage
      FROM sales s
      JOIN sales_items si ON s.sale_id = si.sale_id
      JOIN products p ON si.product_id = p.product_id
      GROUP BY si.product_id, p.product_name
      ORDER BY SUM(s.total_amount) DESC
      LIMIT 5;
    `);

    // Last month's sales query (adjusted for ONLY_FULL_GROUP_BY)
    const [lastMonthSalesData] = await db.query(`
      SELECT DATE_FORMAT(date, '%m/%d') AS date, sale
      FROM (
        SELECT DATE(sale_date) AS date, SUM(total_amount) AS sale
        FROM sales
        WHERE sale_date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) AND CURRENT_DATE()
        GROUP BY DATE(sale_date)
      ) AS daily_sales
      ORDER BY date ASC;
    `);

    // Low stock query
    const [lowStockData] = await db.query(`
      SELECT p.product_name, p.product_type, s.stock_quantity,s.store_name
      FROM stock s
      JOIN products p ON s.product_id = p.product_id
      WHERE s.stock_quantity <= p.low_count
      ORDER BY s.stock_quantity ASC;
    `);

    // Pending transfers query
    const [pendingTransfersData] = await db.query(`
      SELECT transfer_to, 
             DATE_FORMAT(transfer_date, '%Y/%m/%d') AS date
      FROM transfer
      WHERE transfer_approval = 'sending'
      ORDER BY transfer_date DESC
      LIMIT 5;
    `);

    // Daily Profit
    const [dailyProfitData] = await db.query(`
      SELECT 
        DATE(NOW()) AS date,
        (SELECT SUM(income_amount) FROM income WHERE DATE(created_at) = DATE(NOW())) AS total_income,
        (SELECT SUM(expense_amount) FROM expense WHERE DATE(created_at) = DATE(NOW())) AS total_expense,
        (SELECT SUM(income_amount) FROM income WHERE DATE(created_at) = DATE(NOW())) - 
        (SELECT SUM(expense_amount) FROM expense WHERE DATE(created_at) = DATE(NOW())) AS profit
    `);

    // Monthly Profit
    const [monthlyProfitData] = await db.query(`
      SELECT 
        DATE_FORMAT(NOW(), '%Y-%m') AS month,
        (SELECT SUM(income_amount) FROM income WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())) AS total_income,
        (SELECT SUM(expense_amount) FROM expense WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())) AS total_expense,
        (SELECT SUM(income_amount) FROM income WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())) - 
        (SELECT SUM(expense_amount) FROM expense WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())) AS profit
    `);

    res.status(200).json({
      sales: {
        monthly_sales: monthlySalesData[0]?.monthly_sales || 0,
        daily_sales: dailySalesData[0]?.daily_sales || 0,
        daily_profit: dailyProfitData[0],
        monthly_profit: monthlyProfitData[0],
      },
      top_sales: topSalesData,
      last_month_sales: lastMonthSalesData,
      low_stock: lowStockData,
      pending_transfers: pendingTransfersData,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error inside server during fetching dashboard data.",
      err: err,
    });
  }
};

module.exports = {
  getDashboardData,
};
