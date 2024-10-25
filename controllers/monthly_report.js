const db = require("../config/db");

const router = express.Router();

router.get("/monthlyReport", async (req, res) => {
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ message: "Month and year are required" });
    }

    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`; // Simplified, assuming 31 days in the month

    const sql = `
        SELECT 
            SUM(total_income) AS total_income, 
            SUM(total_expense) AS total_expense,
            store_id,
            store_name,
            DATE(created_at) AS date,
            SUM(income_amount) AS income,
            SUM(expense_amount) AS expense
        FROM transactions
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY store_id, DATE(created_at)
    `;

    try {
        const [rows] = await db.query(sql, [startDate, endDate]);

        if (!rows.length) {
            return res.status(404).json({ message: "No records found for the specified month." });
        }

        // Group data by store and format the response
        let totalIncome = 0, totalExpense = 0;
        const report = {};

        rows.forEach(row => {
            totalIncome += row.income;
            totalExpense += row.expense;

            if (!report[row.store_name]) {
                report[row.store_name] = {
                    store: row.store_name,
                    sales: []
                };
            }

            report[row.store_name].sales.push({
                date: row.date,
                income: row.income,
                expence: row.expense
            });
        });

        const isProfit = totalIncome > totalExpense;
        const difference = totalIncome - totalExpense;

        return res.json({
            total_income: totalIncome,
            total_expence: totalExpense,
            is_profit: isProfit,
            difference,
            report: Object.values(report)
        });
    } catch (err) {
        console.error("Error fetching monthly report:", err.message);
        return res.status(500).json({ message: "Error fetching monthly report", err });
    }
});

module.exports = router;
