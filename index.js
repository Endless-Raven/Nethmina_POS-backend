const express = require("express");
const app = express();
const cors = require("cors");
const database = require("./config/db");

const salesRoutes = require("./routes/sales");
const productRoutes = require("./routes/product");
const stores = require("./routes/stores");


app.use(cors());
app.use(express.json());


app.use("/sales", salesRoutes);
app.use("/product", productRoutes);
app.use("/stores", stores);



app.listen(3000, () => {
  console.log("Server listening on port 3000");
});