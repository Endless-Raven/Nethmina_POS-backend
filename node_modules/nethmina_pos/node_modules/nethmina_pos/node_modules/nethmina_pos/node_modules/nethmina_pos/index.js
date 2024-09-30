const express = require("express");
const app = express();
const database = require("./config/db");


app.listen(3000, () => {
  console.log("Server listening on port 3000");
});