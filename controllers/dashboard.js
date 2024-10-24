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
        WHERE sale_date = CURRENT_DATE();
      `);
  
      // Fetching top 5 products by sales
      const [topSalesData] = await db.query(`
        SELECT p.product_name AS name,
               (SUM(s.total_amount) / (SELECT SUM(total_amount) FROM sales) * 100) AS percentage
        FROM sales s
        JOIN sales_items si ON s.sale_id = si.sale_id
        JOIN products p ON si.product_id = p.product_id
        GROUP BY si.product_id
        ORDER BY SUM(s.total_amount) DESC
        LIMIT 5;
      `);
  
      // Last month's sales query
      const [lastMonthSalesData] = await db.query(`
        SELECT DATE_FORMAT(sale_date, '%m/%d') AS date, SUM(total_amount) AS sale
        FROM sales
        WHERE sale_date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) AND CURRENT_DATE()
        GROUP BY DATE(sale_date)
        ORDER BY sale_date ASC;
      `);
  
      // Low stock query
      const [lowStockData] = await db.query(`
        SELECT p.product_name, p.product_type, s.stock_quantity
        FROM stock s
        JOIN products p ON s.product_id = p.product_id
        WHERE s.stock_quantity <= 10
        ORDER BY s.stock_quantity ASC;
      `);
  
      // Pending transfers query
      const [pendingTransfersData] = await db.query(`
        SELECT transfer_to, transfer_date AS date
        FROM transfer
        WHERE transfer_date >= CURRENT_DATE();
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
