const express = require("express");
const app = express();
const cors = require("cors");
const database = require("./config/db");

const salesRoutes = require("./routes/sales");
const productRoutes = require("./routes/product");
const stores = require("./routes/stores");
const userRoutes = require("./routes/users");
const customerRoutes = require("./routes/customer");
const cashierRoutes = require("./routes/cashier");
const warrantyRoutes = require("./routes/warranty");
const stockRoutes = require("./routes/stock");
const dashboardRoutes = require("./routes/dashboard");
const incomeRoutes = require("./routes/income");
const expenseRoutes = require("./routes/expense");
const monthly_reportRoutes = require("./routes/monthly_report");
const employee_and_shop = require("./routes/employee_and_shop");
const product_return = require("./routes/return");
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Nethmina POS backend!'); // Welcome message
});

app.use("/sales", salesRoutes);
app.use("/product", productRoutes);
app.use("/stores", stores);
app.use("/users", userRoutes);
app.use("/customers", customerRoutes);
app.use("/cashiers", cashierRoutes);
app.use("/warranty", warrantyRoutes);
app.use("/stock", stockRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/income", incomeRoutes);
app.use("/expense", expenseRoutes);
app.use("/report", monthly_reportRoutes);
app.use("/employee_and_shop", employee_and_shop);
app.use("/return", product_return);

app.listen(4500, () => {
  console.log("Server listening on port 4500");
});