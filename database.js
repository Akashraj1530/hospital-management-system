// database.js
import mysql from "mysql2";

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "akash@123",            // ← put your MySQL password
  database: "hospital_db", // ← your DB name
  multipleStatements: false
});

connection.connect((err) => {
  if (err) {
    console.error("❌ MySQL Connection Error:", err.message);
    process.exit(1);
  }
  console.log("✅ MySQL Database Connected");
});

export default connection;
