const db = require("../config/db");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const { addCustomerpera } = require("../controllers/customer");
const cron = require("node-cron");

// Step 1: Generate the next ID
// Function to generate the next ID based on store name
const generateNextId = async (store_name) => {
  // Get the first two letters of the store_name
  const prefix = store_name.substring(0, 2).toLowerCase(); // Ensure it’s in lowercase

  // Query to get the maximum sale_id from the sales table
  const query = "SELECT sale_id FROM sales";
  const [results] = await db.query(query);

  // If there are no sales in the database, return the first ID for the user
  if (results.length === 0) {
    return `${prefix}0001`;
  }

  // Convert sale_id to string and extract the numeric part
  const ids = results.map((sale) => parseInt(sale.sale_id.slice(2))); // Skip the first 2 characters (prefix)

  // Get the maximum ID
  const maxId = Math.max(...ids);

  // Generate the next ID by incrementing the maxId and padding it to 4 digits
  return `${prefix}${(maxId + 1).toString().padStart(4, "0")}`;
};

// Function to get store name by user ID
const getStoreNameByUser = async (user_id) => {
  const sql = `
    SELECT store_name 
    FROM stores
    INNER JOIN users ON users.store_id = stores.store_id
    WHERE users.user_id = ?;
  `;

  const [rows] = await db.query(sql, [user_id]);

  if (rows.length === 0) {
    throw new Error(`Store not found for user ID: ${user_id}`);
  }

  return rows[0].store_name;
};

// Function to make a sale
const makesale = async (req, res) => {
  try {
    const {
      cashier_id,
      sales_person,
      total_amount,
      products,
      user,
      customer_details,
    } = req.body;

    // Step 1: Validate customer details (check phone number)
    const customerPhoneNumber = customer_details.customer_phone_number;
    if (!customerPhoneNumber) {
      return res.status(400).json({ message: "Customer phone number is required." });
    }

    // Check if customer already exists by phone number
    const [customer] = await db.query(
      "SELECT customer_id FROM customers WHERE customer_phone_number = ?",
      [customerPhoneNumber]
    );

    let customer_id;
    if (customer.length === 0) {
      // If customer not found, insert new customer
      const insertCustomerQuery = `
        INSERT INTO customers (customer_name, customer_phone_number, customer_address) 
        VALUES (?, ?, ?);
      `;
      const result = await db.query(insertCustomerQuery, [
        customer_details.customer_name,
        customerPhoneNumber,
        customer_details.customer_address,
      ]);
      customer_id = result[0].insertId;
    } else {
      customer_id = customer[0].customer_id;
    }

    // Step 2: Retrieve store_name based on user (user_id)
    const store_name = await getStoreNameByUser(user);
    if (!store_name) {
      return res.status(400).json({ message: "Store not found for the given user." });
    }

    // Step 3: Check stock availability for all products
    for (const product of products) {
      const { product_id, quantity } = product;

      const [stockResult] = await db.query(
        "SELECT stock_quantity FROM stock WHERE store_name = ? AND product_id = ?",
        [store_name, product_id]
      );

      if (stockResult.length === 0 || stockResult[0].stock_quantity < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product ID: ${product_id}. Sale not allowed.`,
        });
      }
    }

    // Step 4: Generate the sales_id based on store_name
    const sales_id = await generateNextId(store_name);
    if (!sales_id) {
      return res.status(500).json({ message: "Failed to generate sales ID." });
    }

    // Step 5: Insert into sales table
    const salesQuery = `
      INSERT INTO sales (sale_id, cashier_id, sales_person, total_amount, customer_id)
      VALUES (?, ?, ?, ?, ?);
    `;
    await db.query(salesQuery, [
      sales_id,
      cashier_id,
      sales_person,
      total_amount,
      customer_id,
    ]);

    // Step 6: Insert into sales_items and update product and stock
    const salesItemQuery = `
      INSERT INTO sales_items (sale_id, product_id, item_quantity, item_price, imei_number, discount, warranty_period)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    const updateProductStockAndImeiQuery = `
      UPDATE products
      SET product_stock = product_stock - ?, imei_number = ?
      WHERE product_id = ? AND product_stock >= ?;
    `;

    const updateStockQuery = `
      UPDATE stock
      SET stock_quantity = stock_quantity - ?, imei_numbers = ?
      WHERE store_name = ? AND product_id = ? AND stock_quantity >= ?;
    `;

    for (const product of products) {
      const { product_id, quantity, price, serial_number, discount } = product;

      const [productDetails] = await db.query(
        "SELECT warranty_period FROM products WHERE product_id = ?",
        [product_id]
      );
      const warranty_period = productDetails[0]?.warranty_period;

      // Check product type (e.g., mobile phones)
      const [productTypeResult] = await db.query(
        "SELECT product_type FROM products WHERE product_id = ?",
        [product_id]
      );
      const productType = productTypeResult[0]?.product_type;

      if (productType === "Mobile Phone") {
        // Handle IMEI numbers for mobile phones
        const [currentImeiResult] = await db.query(
          "SELECT imei_number FROM products WHERE product_id = ?",
          [product_id]
        );
        const currentImeiNumbers = currentImeiResult[0]?.imei_number.split(",") || [];

        if (!currentImeiNumbers.includes(serial_number)) {
          return res.status(400).json({
            message: `Invalid IMEI number for product ${product_id}. Sale not allowed.`,
          });
        }

        const updatedImeiNumbers = currentImeiNumbers
          .filter((imei) => imei !== serial_number)
          .join(",");

        // Update product stock and IMEI
        const [productStockUpdated] = await db.query(
          updateProductStockAndImeiQuery,
          [quantity, updatedImeiNumbers, product_id, quantity]
        );

        if (productStockUpdated.affectedRows === 0) {
          throw new Error(`Insufficient product stock for product ${product_id}.`);
        }

        const [currentStockImeiResult] = await db.query(
          "SELECT imei_numbers FROM stock WHERE store_name = ? AND product_id = ?",
          [store_name, product_id]
        );
        const currentStockImeiNumbers = currentStockImeiResult[0]?.imei_numbers.split(",") || [];

        const updatedStockImeiNumbers = currentStockImeiNumbers
          .filter((imei) => imei !== serial_number)
          .join(",");

        const [stockUpdated] = await db.query(updateStockQuery, [
          quantity,
          updatedStockImeiNumbers,
          store_name,
          product_id,
          quantity,
        ]);

        if (stockUpdated.affectedRows === 0) {
          throw new Error(`Failed to update stock for product ${product_id} in store ${store_name}.`);
        }
      }else {
        // For non-mobile phones, update product stock and set IMEI number to an empty string
        const [productStockUpdated] = await db.query(
          updateProductStockAndImeiQuery,
          [quantity, "", product_id, quantity] // Set IMEI number to an empty string
        );
      
        if (productStockUpdated.affectedRows === 0) {
          throw new Error(`Failed to update stock for product ${product_id}.`);
        }
      
        // Update store stock and set IMEI numbers to an empty string
        const [stockUpdated] = await db.query(updateStockQuery, [
          quantity,
          "", // Set IMEI numbers to an empty string for non-mobile products
          store_name,
          product_id,
          quantity,
        ]);
      
        if (stockUpdated.affectedRows === 0) {
          throw new Error(`Failed to update stock for product ${product_id} in store ${store_name}.`);
        }
      }

      // Insert all product details into the sales_items table
      productprice = price - discount;
      await db.query(salesItemQuery, [
        sales_id,
        product_id,
        quantity,
        productprice,
        serial_number, // Include IMEI number here for mobile phones
        discount,
        warranty_period,
      ]);
    }

    // Step 7: Send receipt email
    if (customer_details.customer_email) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.email",
      port: 465,
      secure: true, // true for port 465, false for other ports
      auth: {
        user: process.env.EMAIL, // Add this in your .env file
        pass: process.env.EMAIL_PASS, // Add this in your .env file
      },
    });

    const receiptHTML = `
    <h1>Receipt for Your Purchase</h1>
    <p><strong>Sales ID:</strong> ${sales_id}</p>
    <p><strong>Store:</strong> ${store_name}</p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    <p><strong>Customer Name:</strong> ${customer_details.customer_name}</p>
    <p><strong>Total Amount:</strong> RS${total_amount.toFixed(2)}</p>
    <hr>
    <h3>Products:</h3>
    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 8px;">Product Name</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Price Each</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Discount</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${products
          .map(
            (p) => `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${p.product_name}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${p.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">RS${p.price.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">RS${p.discount.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">RS${(
              (p.price - p.discount) *
              p.quantity
            ).toFixed(2)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    <hr>
    <p><strong>Thank you for shopping with us!</strong></p>
    <p>If you have any questions or concerns, feel free to contact us at ${process.env.EMAIL}.</p>
  `;
  
console.log(process.env.EMAIL_USER);
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: customer_details.customer_email, // Customer's email
      subject: "Your Receipt from " + store_name,
      html: receiptHTML,
    });
}

    // Respond to the client
    return res.status(200).json({ message: "Sale processed successfully and receipt sent.", sales_id });
  

  } catch (err) {
    console.error("Error processing sales and items:", err.message);
    return res.status(500).json({ message: "Error inside server during sales processing.", err });
  }
};


const getsales = async (req, res) => {
  console.log("Request body", req.body);

  const sql = "SELECT * FROM sales";

  try {
    console.log("get products");
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

const getsalebyid = async (req, res) => {
  // Extract sale_id from the request parameters
  const { sale_id } = req.params;

  const sql = "SELECT * FROM sales WHERE sale_id = ?";

  try {
    console.log("Fetching sale with ID:", sale_id);
    const [rows] = await db.query(sql, [sale_id]);

    // Check if the sale was found
    if (rows.length === 0) {
      return res.status(404).json({ message: "Sale not found." });
    }

    // Return the found sale
    return res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching sale:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};
// const getDailySalesReport = async (req, res) => {

//   const { date } = req.query; // Date will be passed from the frontend in the format 'YYYY-MM-DD'

//   const sql = `
//     SELECT
//       sales.sale_id,
//       sales.sales_person,
//       sales.total_amount,
//       sales.created_at AS sale_date,
//       cashiers.cashier_name,
//       stores.store_name,
//       stores.store_address,
//       stores.store_phone_number,
//       sales_items.product_id,
//       sales_items.item_quantity,
//       sales_items.item_price,
//       sales_items.imei_number,
//       sales_items.discount
//     FROM sales_items
//     INNER JOIN sales ON sales.sale_id = sales_items.sale_id
//     INNER JOIN cashiers ON sales.cashier_id = cashiers.cashier_id
//     INNER JOIN stores ON cashiers.store_id = stores.store_id
//     WHERE DATE(sales.created_at) = ?
//     ORDER BY stores.store_name, sales.sale_id;
//   `;

//   try {
//     // Fetch the sales report based on the provided date
//     const [rows] = await db.query(sql, [date]);

//     if (rows.length === 0) {
//       return res.status(404).json({ message: "No sales found for the given date." });
//     }

//     // Group the results by store
//     const salesReportByStore = rows.reduce((report, sale) => {
//       const { store_name } = sale;

//       if (!report[store_name]) {
//         report[store_name] = [];
//       }

//       // Add the sale to the corresponding store's array
//       report[store_name].push(sale);
//       return report;
//     }, {});

//     return res.status(200).json({ message: "Daily sales report generated successfully.", report: salesReportByStore });
//   } catch (err) {
//     console.error("Error generating daily sales report:", err.message);
//     return res.status(500).json({ message: "Error inside server during daily sales report generation.", err });
//   }
// };

// Function to create a PDF report and send via email
// Function to create a PDF report and send via email

const getSalesItemsByDate = async (req, res) => {
  const { date } = req.query; // Get the date from request query parameters

  const sql = `
    SELECT
      sales_items.sale_item_id,
      sales_items.sale_id,
      sales_items.product_id,
      sales_items.item_quantity,
      sales_items.item_price,
      sales_items.imei_number,
      sales_items.discount,
      sales_items.warranty_period,
      sales.created_at AS sale_date,
      cashiers.cashier_name,
      stores.store_name,
      products.product_name
    FROM sales_items
    INNER JOIN sales ON sales.sale_id = sales_items.sale_id
    INNER JOIN cashiers ON sales.cashier_id = cashiers.cashier_id
    INNER JOIN stores ON cashiers.store_id = stores.store_id
    INNER JOIN products ON products.product_id = sales_items.product_id
    WHERE DATE(sales.created_at) = ?
    ORDER BY stores.store_name, sales_items.sale_item_id;
  `;

  try {
    // Execute the SQL query to get the sales items for the specified date
    const [rows] = await db.query(sql, [date]);

    // If no sales items are found for the date, return a 404 response
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No sales items found for the given date." });
    }

    // Organize sales data by stores
    const storesSales = {};

    rows.forEach((item) => {
      const storeName = item.store_name;

      // If the store doesn't exist in the storesSales object, initialize it
      if (!storesSales[storeName]) {
        storesSales[storeName] = {
          store_name: storeName,
          total_sales: 0,
          sales: [],
        };
      }

      // Add the sale item to the store's sales array
      storesSales[storeName].sales.push({
        sale_item_id: item.sale_item_id,
        sale_id: item.sale_id,
        product_id: item.product_id,
        product_name: item.product_name, // Include product name
        item_quantity: item.item_quantity,
        item_price: item.item_price,
        imei_number: item.imei_number,
        discount: item.discount,
        warranty_period: item.warranty_period,
        sale_date: item.sale_date,
        cashier_name: item.cashier_name,
      });

      // Increment the total sales for the store
      storesSales[storeName].total_sales += parseFloat(
        item.item_price * item.item_quantity - item.discount
      );
    });

    // Return the sales data grouped by stores
    return res.status(200).json({ stores_sales: Object.values(storesSales) });
  } catch (err) {
    console.error("Error fetching sales items by date:", err.message);
    return res
      .status(500)
      .json({ message: "Error inside server during sales items fetch.", err });
  }
};

const getDailySalesReport = async (req, res) => {
  const { date } = req.query;

  const sql = `
    SELECT
      sales.sale_id,
      sales.sales_person,
      sales.total_amount,
      sales.created_at AS sale_date,
      cashiers.cashier_name,
      stores.store_name,
      stores.store_address,
      stores.store_phone_number,
      sales_items.product_id,
      sales_items.item_quantity,
      sales_items.item_price,
      sales_items.imei_number,
      sales_items.discount
    FROM sales_items
    INNER JOIN sales ON sales.sale_id = sales_items.sale_id
    INNER JOIN cashiers ON sales.cashier_id = cashiers.cashier_id
    INNER JOIN stores ON cashiers.store_id = stores.store_id
    WHERE DATE(sales.created_at) = ?
    ORDER BY stores.store_name, sales.sale_id;
  `;

  try {
    const [rows] = await db.query(sql, [date]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No sales found for the given date." });
    }

    // Group the results by store
    const salesReportByStore = rows.reduce((report, sale) => {
      const { store_name } = sale;

      if (!report[store_name]) {
        report[store_name] = [];
      }

      report[store_name].push(sale);
      return report;
    }, {});

    // Create PDF document
    const pdfDoc = new PDFDocument();
    let pdfBuffer = [];

    pdfDoc.on("data", (chunk) => pdfBuffer.push(chunk));
    pdfDoc.on("end", () => {
      const bufferData = Buffer.concat(pdfBuffer);
      sendEmailWithReport(bufferData, date);
    });

    // Start adding content to the PDF
    pdfDoc.fontSize(20).text("Daily Sales Report", { align: "center" });
    pdfDoc.fontSize(12).text(`Date: ${date}`, { align: "center" });

    // Use monospaced font for better alignment
    pdfDoc.font("Courier");

    // Loop through each store and its sales data
    Object.keys(salesReportByStore).forEach((store) => {
      const sales = salesReportByStore[store];

      // Add a new page for each store
      pdfDoc
        .addPage()
        .fontSize(16)
        .text(`Store: ${store}`, { underline: true });
      pdfDoc.fontSize(12).text(`Address: ${sales[0].store_address}`);
      pdfDoc.text(`Phone: ${sales[0].store_phone_number}`);

      // Column headers
      pdfDoc.moveDown();
      pdfDoc.text(
        "Sales Person      Total Amount      IMEI           Discount     Sale Date",
        { underline: true }
      );

      // Initialize total amount for the store
      let totalAmountForStore = 0;

      // Iterate over the sales and add each sale's data
      sales.forEach((sale) => {
        const saleDate = new Date(sale.sale_date).toLocaleString(); // Format the date
        pdfDoc.text(
          `${(sale.sales_person ?? "").padEnd(15)}  ` +
            `${(sale.total_amount ?? "0").toString().padEnd(15)}  ` +
            `${(sale.imei_number ?? "").padEnd(15)}  ` +
            `${(sale.discount ?? "0").toString().padEnd(10)}  ` +
            `${saleDate}`
        );

        // Accumulate the total amount for the store
        totalAmountForStore += parseFloat(sale.total_amount);
      });

      // Add a line for the total amount for the store
      pdfDoc
        .moveDown()
        .fontSize(14)
        .text(`Total Amount for Store: ${totalAmountForStore.toFixed(2)}`, {
          bold: true,
        });
    });

    pdfDoc.end();
    return res
      .status(200)
      .json({
        message: "Daily sales report generated and email will be sent.",
      });
  } catch (err) {
    console.error("Error generating daily sales report:", err.message);
    return res
      .status(500)
      .json({
        message: "Error inside server during daily sales report generation.",
        err,
      });
  }
};

// Function to send the email with the PDF report attached
const sendEmailWithReport = (pdfBuffer, reportDate) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // Use your email service provider
    host: "smtp.gmail.email",
    port: 465,
    secure: true, // true for port 465, false for other ports
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS, // Use environment variables for sensitive data
    },
  });
  const fileName = `daily_sales_report_${reportDate}.pdf`;
  const mailOptions = {
    from: process.env.EMAIL,
    to: process.env.recipientEmail,
    subject: "Daily Sales Report",
    text: "Please find attached the daily sales report.",
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error("Error sending email:", err.message);
    } else {
      console.log("Email sent:", info.response);
    }
  });
};

// Schedule the job to run every day at 11 PM
cron.schedule("00 23 * * *", async () => {
  // Runs every day at 11 PM
  const date = new Date().toISOString().split("T")[0]; // Get today's date in 'YYYY-MM-DD' format
  const email = process.env.EMAIL; // Replace with the actual email you want to send to

  // Create mock request and response objects
  const req = { query: { date, email } };
  const res = {
    status: (statusCode) => ({
      json: (responseBody) =>
        console.log(`Response: ${statusCode}`, responseBody),
    }),
  };

  try {
    await getDailySalesReport(req, res);
  } catch (error) {
    console.error("Error executing daily sales report cron job:", error);
  }
});




module.exports = {
  makesale,
  getsales,
  getsalebyid,
  getDailySalesReport,
  getSalesItemsByDate,
};
