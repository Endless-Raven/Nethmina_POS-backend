const db = require("../config/db");

// Fetch Monthly Report
const getMonthlyReport = async (req, res) => {
    const { month, year } = req.query;

    try {
        const sql = `
            SELECT total_income, total_expense, 
                   (total_income - total_expense) AS difference,
                   total_income > total_expense AS is_profit,
                   income, expense
            FROM monthly_report
            WHERE MONTH(start_date) = ? AND YEAR(start_date) = ?
        `;
        
        const [report] = await db.query(sql, [month, year]);

        // If no report is found, return the "Report not found" message
        if (report.length === 0) {
            return res.status(404).json({ message: "Report not found for the specified month and year." });
        }

        // Parsing income and expense details to add them into the response as objects
        const formattedReport = {
            ...report[0],
            income: JSON.parse(report[0].income),
            expense: JSON.parse(report[0].expense)
        };

        return res.json(formattedReport);
    } catch (err) {
        console.error("Error fetching monthly report:", err.message);
        return res.status(500).json({ message: "Error fetching monthly report", err });
    }
};

// Fetch Daily Report
const getDailyReport = async (req, res) => {
    const { date } = req.query;

    try {
        const incomeSql = `
            SELECT income_category AS category, income_amount AS amount, created_at AS time, true AS is_income
            FROM income
            WHERE DATE(created_at) = ?
        `;
        const expenseSql = `
            SELECT expense_category AS category, expense_amount AS amount, created_at AS time, false AS is_income
            FROM expense
            WHERE DATE(created_at) = ?
        `;

        const [incomeResults] = await db.query(incomeSql, [date]);
        const [expenseResults] = await db.query(expenseSql, [date]);

        const report = incomeResults.concat(expenseResults).sort((a, b) => new Date(a.time) - new Date(b.time));

        const totalIncome = incomeResults.reduce((sum, { amount }) => sum + amount, 0);
        const totalExpense = expenseResults.reduce((sum, { amount }) => sum + amount, 0);
        
        const response = {
            total_income: totalIncome,
            total_expense: totalExpense,
            is_profit: totalIncome > totalExpense,
            difference: totalIncome - totalExpense,
            report
        };

        res.json(response);
    } catch (err) {
        console.error("Error fetching daily report:", err.message);
        res.status(500).json({ message: "Error fetching daily report", err });
    }
};

module.exports = {
    getMonthlyReport,
    getDailyReport,
};