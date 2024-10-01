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



app.use(cors());
app.use(express.json());


app.use("/sales", salesRoutes);
app.use("/product", productRoutes);
app.use("/stores", stores);
app.use("/users", userRoutes);
app.use("/customers", customerRoutes);
app.use("/cashiers", cashierRoutes);



app.listen(3000, () => {
  console.log("Server listening on port 3000");
});