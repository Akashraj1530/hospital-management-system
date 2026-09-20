// database.js

import mysql from "mysql2";
import "dotenv/config";

const connection = mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
    port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || "root",
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || "hospital_db",
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