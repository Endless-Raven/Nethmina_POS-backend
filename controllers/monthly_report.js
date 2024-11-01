const db = require("../config/db");
const cron = require("node-cron");


// Fetch Monthly Report
const getMonthlyReport = async (req, res) => {
    const { month, year } = req.query;

    const yearInt = parseInt(year);
    const monthInt = parseInt(month);

    if (isNaN(yearInt) || isNaN(monthInt)) {
        return res.status(400).json({ message: "Invalid month or year parameter." });
    }

    try {
        console.log(`Fetching monthly report for: month = ${monthInt}, year = ${yearInt}`);

        // Separate queries for income and expense
        const incomeSql = `
            SELECT 
                stores.store_name,
                DATE(income.created_at) AS date,
                COALESCE(SUM(income.income_amount), 0) AS total_income
            FROM 
                stores
            LEFT JOIN 
                income ON stores.store_id = income.store_id 
                AND MONTH(income.created_at) = ? 
                AND YEAR(income.created_at) = ?
                AND income.approval_status = 'confirmed'
            GROUP BY 
                stores.store_name, DATE(income.created_at)
            ORDER BY 
                stores.store_name, date;
        `;

        const expenseSql = `
            SELECT 
                stores.store_name,
                DATE(expense.created_at) AS date,
                COALESCE(SUM(expense.expense_amount), 0) AS total_expense
            FROM 
                stores
            LEFT JOIN 
                expense ON stores.store_id = expense.store_id 
                AND MONTH(expense.created_at) = ? 
                AND YEAR(expense.created_at) = ?
                AND expense.approval_status = 'confirmed'
            GROUP BY 
                stores.store_name, DATE(expense.created_at)
            ORDER BY 
                stores.store_name, date;
        `;

        const [incomeReport] = await db.query(incomeSql, [monthInt, yearInt]);
        const [expenseReport] = await db.query(expenseSql, [monthInt, yearInt]);

        // Combine income and expense data
        const reportMap = {};

        incomeReport.forEach(item => {
            const key = `${item.store_name}-${item.date}`;
            reportMap[key] = {
                store: item.store_name,
                date: item.date,
                income: parseFloat(item.total_income),
                expense: 0 // Initialize with 0, updated later if needed
            };
        });

        expenseReport.forEach(item => {
            const key = `${item.store_name}-${item.date}`;
            if (reportMap[key]) {
                reportMap[key].expense = parseFloat(item.total_expense);
            } else {
                reportMap[key] = {
                    store: item.store_name,
                    date: item.date,
                    income: 0, // Initialize with 0, updated later if needed
                    expense: parseFloat(item.total_expense)
                };
            }
        });

        // Transform map to array
        const formattedReport = Object.values(reportMap).reduce((acc, item) => {
            let storeEntry = acc.find(s => s.store === item.store);
            if (!storeEntry) {
                storeEntry = { store: item.store, sales: [] };
                acc.push(storeEntry);
            }

            storeEntry.sales.push({
                date: `${yearInt}/${monthInt}/${new Date(item.date).getDate()}`,
                income: item.income,
                expence: item.expense
            });

            return acc;
        }, []);

        // Calculate total income, expense, and profit details
        const totalIncome = formattedReport.reduce((sum, store) =>
            sum + store.sales.reduce((s, sale) => s + sale.income, 0), 0);
        const totalExpense = formattedReport.reduce((sum, store) =>
            sum + store.sales.reduce((s, sale) => s + sale.expence, 0), 0);
        const summary = {
            total_income: totalIncome,
            total_expence: totalExpense,
            is_profit: totalIncome > totalExpense,
            difference: totalIncome - totalExpense,
            report: formattedReport
        };
console.log(totalExpense);
        return res.json(summary);
    } catch (err) {
        console.error("Error fetching monthly report:", err.message);
        return res.status(500).json({ message: "Error fetching monthly report", err });
    }
};


// Fetch Daily Report
const getDailyReport = async (req, res) => {
    const { date, store_name } = req.query;

    if (!date) {
        return res.status(400).json({ message: "Date parameter is required." });
    }

    try {
        // Step 1: Get the store_id based on store_name
        const storeIdQuery = `
            SELECT store_id 
            FROM stores 
            WHERE store_name = ?;
        `;
        const [storeResult] = await db.query(storeIdQuery, [store_name]);

        if (storeResult.length === 0) {
            return res.status(404).json({ message: "Store not found." });
        }

        const store_id = storeResult[0].store_id;

        // Step 2: Query for income
        const incomeSql = `
            SELECT 
                income.store_id AS store_id, 
                stores.store_name, 
                income.income_category AS category, 
                income.income_amount AS amount, 
                TIME_FORMAT(income.created_at, '%H:%i') AS time, 
                true AS is_income
            FROM 
                income
            JOIN 
                stores ON income.store_id = stores.store_id
            WHERE 
                DATE(income.created_at) = ?
                AND income.store_id = ?;
        `;

        // Step 3: Query for expense
        const expenseSql = `
            SELECT 
                expense.store_id AS store_id, 
                stores.store_name, 
                expense.expense_category AS category, 
                expense.expense_amount AS amount, 
                TIME_FORMAT(expense.created_at, '%H:%i') AS time, 
                false AS is_income
            FROM 
                expense
            JOIN 
                stores ON expense.store_id = stores.store_id
            WHERE 
                DATE(expense.created_at) = ?
                AND expense.store_id = ?;
        `;

        const [incomeResults] = await db.query(incomeSql, [date, store_id]);
        const [expenseResults] = await db.query(expenseSql, [date, store_id]);

        // Combine and sort all results by time
        const reportData = incomeResults.concat(expenseResults).sort((a, b) => 
            new Date(`1970-01-01T${a.time}`) - new Date(`1970-01-01T${b.time}`)
        );

        // Group sales by store
        const groupedReport = reportData.reduce((acc, item) => {
            const storeEntry = acc.find(store => store.store === item.store_name);
            const salesItem = {
                time: item.time,
                category: item.category,
                is_income: item.is_income,
                amount: parseInt(item.amount, 10)
            };

            if (storeEntry) {
                storeEntry.sales.push(salesItem);
            } else {
                acc.push({ store: item.store_name, sales: [salesItem] });
            }

            return acc;
        }, []);

        // Calculate total income and expenses
        const totalIncome = incomeResults.reduce((sum, { amount }) => sum + parseFloat(amount), 0);
        const totalExpense = expenseResults.reduce((sum, { amount }) => sum + parseFloat(amount), 0);

        const formattedReport = {
            total_income: Math.round(totalIncome),
            total_expense: Math.round(totalExpense),
            is_profit: totalIncome > totalExpense,
            difference: Math.round(totalIncome - totalExpense),
            report: groupedReport
        };

        res.json(formattedReport);
    } catch (err) {
        console.error("Error fetching daily report:", err.message);
        res.status(500).json({ message: "Error fetching daily report", err });
    }
};



const updateMonthlyReport = async () => {
    const now = new Date();
    const month = now.getMonth(); // Get current month (0-11)
    const year = now.getFullYear();

    // Define start and end dates for the previous month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Queries for total income and total expense for the month
    const incomeSql = `
        SELECT SUM(income_amount) as total_income 
        FROM income 
        WHERE MONTH(created_at) = ? 
          AND YEAR(created_at) = ? 
          AND approval_status = 'confirmed'
    `;
    
    const expenseSql = `
        SELECT SUM(expense_amount) as total_expense 
        FROM expense 
        WHERE MONTH(created_at) = ? 
          AND YEAR(created_at) = ? 
          AND approval_status = 'confirmed'
    `;

    try {
        const [incomeResult] = await db.query(incomeSql, [month, year]);
        const [expenseResult] = await db.query(expenseSql, [month, year]);

        const totalIncome = incomeResult[0].total_income || 0;
        const totalExpense = expenseResult[0].total_expense || 0;
        const isProfit = totalIncome < totalExpense;
        const profitLossStatus = isProfit ? "profit" : "loss";

        // Insert or update monthly report
        const updateSql = `
            INSERT INTO monthly_report (month, start_date, end_date, total_income, total_expense, profit_loss)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                total_income = VALUES(total_income), 
                total_expense = VALUES(total_expense),
                profit_loss = VALUES(profit_loss)
        `;

        await db.query(updateSql, [
            `${year}-${month}`,
            startDate,
            endDate,
            totalIncome,
            totalExpense,
            profitLossStatus
        ]);

        console.log("Monthly report updated successfully");
    } catch (err) {
        console.error("Error updating monthly report:", err.message);
    }
};

// Schedule to run on the first day of every month at midnight
cron.schedule("58 23 * * *", () => {
    updateMonthlyReport();
});
module.exports = {
    getMonthlyReport,
    getDailyReport,
};
