const db = require("../config/db");

// Fetch Monthly Report
const getMonthlyReport = async (req, res) => {
    const { month, year } = req.query;

    // Ensure year and month are integers
    const yearInt = parseInt(year);
    const monthInt = parseInt(month);

    if (isNaN(yearInt) || isNaN(monthInt)) {
        return res.status(400).json({ message: "Invalid month or year parameter." });
    }

    try {
        console.log(`Fetching report for month: ${monthInt}, year: ${yearInt}`);

        // SQL query to calculate total income and expenses for each store for the specified month and year
        const sql = `
            SELECT 
                stores.store_id, 
                stores.store_name,
                COALESCE(SUM(income.income_amount), 0) AS total_income,
                COALESCE(SUM(expense.expense_amount), 0) AS total_expense
            FROM 
                stores
            LEFT JOIN 
                income ON stores.store_id = income.store_id 
                AND MONTH(income.created_at) = ? 
                AND YEAR(income.created_at) = ?
            LEFT JOIN 
                expense ON stores.store_id = expense.store_id 
                AND MONTH(expense.created_at) = ? 
                AND YEAR(expense.created_at) = ?
            GROUP BY 
                stores.store_id, stores.store_name;
        `;

        console.log(`Parameters:`, [monthInt, yearInt, monthInt, yearInt]);

        const [report] = await db.query(sql, [monthInt, yearInt, monthInt, yearInt]);

        // Handle no report found case
        if (!report || report.length === 0) {
            console.log(`No data found for month: ${monthInt}, year: ${yearInt}`);
            return res.status(404).json({ message: "Report not found for the specified month and year." });
        }

        // Formatting the report
        const totalIncome = report.reduce((sum, item) => sum + parseFloat(item.total_income), 0);
        const totalExpense = report.reduce((sum, item) => sum + parseFloat(item.total_expense), 0);
        
        const formattedReport = {
            total_income: totalIncome.toFixed(2), // Convert to string with two decimal places
            total_expense: totalExpense.toFixed(2), // Convert to string with two decimal places
            is_profit: totalIncome > totalExpense,
            difference: totalIncome - totalExpense,
            report: report.map(item => ({
                store: item.store_name,
                sales: [{ 
                    date: `${yearInt}/${monthInt}/1`, // Use a consistent date format for the month
                    income: parseFloat(item.total_income).toFixed(2), // Convert to string with two decimal places
                    expense: parseFloat(item.total_expense).toFixed(2) // Convert to string with two decimal places
                }]
            }))
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

    if (!date) {
        return res.status(400).json({ message: "Date parameter is required." });
    }

    try {
        const incomeSql = `
            SELECT 
                income.store_id AS store_id, 
                stores.store_name, 
                income_category AS category, 
                income_amount AS amount, 
                TIME_FORMAT(income.created_at, '%H:%i') AS time, 
                true AS is_income
            FROM 
                income
            JOIN 
                stores ON income.store_id = stores.store_id
            WHERE 
                DATE(income.created_at) = ?
        `;

        const expenseSql = `
            SELECT 
                expense.store_id AS store_id, 
                stores.store_name, 
                expense_category AS category, 
                expense_amount AS amount, 
                TIME_FORMAT(expense.created_at, '%H:%i') AS time, 
                false AS is_income
            FROM 
                expense
            JOIN 
                stores ON expense.store_id = stores.store_id
            WHERE 
                DATE(expense.created_at) = ?
        `;

        const [incomeResults] = await db.query(incomeSql, [date]);
        const [expenseResults] = await db.query(expenseSql, [date]);

        const report = incomeResults.concat(expenseResults).sort((a, b) => new Date(`1970-01-01T${a.time}`) - new Date(`1970-01-01T${b.time}`));

        const totalIncome = incomeResults.reduce((sum, { amount }) => sum + parseFloat(amount), 0);
        const totalExpense = expenseResults.reduce((sum, { amount }) => sum + parseFloat(amount), 0);

        const formattedReport = {
            total_income: totalIncome.toFixed(2),
            total_expense: totalExpense.toFixed(2),
            is_profit: totalIncome > totalExpense,
            difference: (totalIncome - totalExpense).toFixed(2),
            report: report.map(item => ({
                store: item.store_name,
                sales: [{
                    time: item.time,
                    category: item.category,
                    is_income: item.is_income,
                    amount: parseFloat(item.amount).toFixed(2)
                }]
            }))
        };

        res.json(formattedReport);
    } catch (err) {
        console.error("Error fetching daily report:", err.message);
        res.status(500).json({ message: "Error fetching daily report", err });
    }
};

module.exports = {
    getMonthlyReport,
    getDailyReport,
};
