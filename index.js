const express = require("express");
const app = express();
const cors = require("cors");
const database = require("./config/db");

const salesRoutes = require("./routes/sales");
const storesRoutes = require("./routes/stores");


app.use(cors());
app.use(express.json());


app.use("/sales", salesRoutes);
app.use("/stores", storesRoutes);



app.listen(3000, () => {
  console.log("Server listening on port 3000");
});