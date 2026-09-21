// database.js

import mysql from "mysql2";
import "dotenv/config";

const connection = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || "root",
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || "hospital_db",
    multipleStatements: false
});

connection.connect((err) => {
    if (err) {
        console.error("❌ MySQL Connection Error:", err.message);
        return;
    }

    console.log("✅ MySQL Database Connected");
});

export default connection;