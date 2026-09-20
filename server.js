// server.js

import express from "express";
import cors from "cors";
import path from "path";
import connection from "./database.js";

const app = express();


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());


// ======================================================
// HOME PAGE
// ======================================================

// Open index.html when visiting:
// http://localhost:5000/

app.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});


// ======================================================
// DATABASE CONFIGURATION
// ======================================================

const DB_NAME = "hospital_db";


// ======================================================
// ALLOWED TABLES
// ======================================================

// Only these tables can be accessed through the API.
// This also helps prevent SQL injection through table names.

const ALLOWED_TABLES = [
  "patient",
  "doctor",
  "appointment",
  "billing",
  "department",
  "room",
  "staff",
  "medicine"
];


// ======================================================
// LABEL FIELDS
// ======================================================

// Used for displaying readable names in dropdowns.

const LABEL_FIELDS = {
  patient: "patient_name",
  doctor: "doctor_name",
  department: "department_name",
  staff: "staff_name",
  medicine: "medicine_name",
  room: "room_no"
};


// ======================================================
// HELPER: CHECK ALLOWED TABLE
// ======================================================

function isAllowedTable(name) {
  return ALLOWED_TABLES.includes(name);
}


// ======================================================
// HELPER: DATABASE QUERY
// ======================================================

async function query(sql, params = []) {
  return new Promise((resolve, reject) => {

    connection.query(sql, params, (err, rows) => {

      if (err) {
        return reject(err);
      }

      resolve(rows);

    });

  });
}


// ======================================================
// GET PRIMARY KEY
// ======================================================

// Finds AUTO_INCREMENT primary key of a table.

async function getPrimaryKey(table) {

  const sql = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND EXTRA LIKE '%auto_increment%'
    LIMIT 1
  `;

  const rows = await query(sql, [DB_NAME, table]);

  return rows[0]?.COLUMN_NAME || null;
}


// ======================================================
// GET TABLE COLUMNS
// ======================================================

// Gets column information from MySQL.

async function getColumns(table) {

  const sql = `
    SELECT
      COLUMN_NAME,
      DATA_TYPE,
      IS_NULLABLE,
      COLUMN_KEY,
      EXTRA
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `;

  return await query(sql, [DB_NAME, table]);
}


// ======================================================
// GET ALL ALLOWED TABLES
// ======================================================

app.get("/tables", (_req, res) => {

  res.json(ALLOWED_TABLES);

});


// ======================================================
// GET ALL RECORDS FROM A TABLE
// ======================================================

app.get("/table/:name", async (req, res) => {

  const { name } = req.params;

  // Check table name
  if (!isAllowedTable(name)) {

    return res.status(400).json({
      error: "Table not allowed"
    });

  }

  try {

    const rows = await query(
      `SELECT * FROM \`${name}\``
    );

    res.json(rows);

  } catch (e) {

    res.status(500).json({
      error: e.message
    });

  }

});


// ======================================================
// GET TABLE COLUMNS
// ======================================================

app.get("/table/:name/columns", async (req, res) => {

  const { name } = req.params;

  // Check table name
  if (!isAllowedTable(name)) {

    return res.status(400).json({
      error: "Table not allowed"
    });

  }

  try {

    const cols = await getColumns(name);

    const pk = await getPrimaryKey(name);

    res.json(

      cols.map(c => ({

        name: c.COLUMN_NAME,

        type: c.DATA_TYPE,

        nullable: c.IS_NULLABLE === "YES",

        key: c.COLUMN_KEY,

        extra: c.EXTRA,

        isPrimary: c.COLUMN_NAME === pk

      }))

    );

  } catch (e) {

    res.status(500).json({
      error: e.message
    });

  }

});


// ======================================================
// LOOKUP DATA
// ======================================================

// Example:
// /lookup/patient
// /lookup/doctor
// /lookup/department

app.get("/lookup/:table", async (req, res) => {

  const t = req.params.table;

  // Check table
  if (!isAllowedTable(t)) {

    return res.status(400).json({
      error: "Table not allowed"
    });

  }

  try {

    const pk = await getPrimaryKey(t);

    const label = LABEL_FIELDS[t] || pk;

    const rows = await query(
      `SELECT \`${pk}\` AS id, \`${label}\` AS label
       FROM \`${t}\``
    );

    res.json(rows);

  } catch (e) {

    res.status(500).json({
      error: e.message
    });

  }

});


// ======================================================
// INSERT NEW RECORD
// ======================================================

app.post("/table/:name", async (req, res) => {

  const { name } = req.params;

  // Check table
  if (!isAllowedTable(name)) {

    return res.status(400).json({
      error: "Table not allowed"
    });

  }

  try {

    // Get columns
    const cols = await getColumns(name);

    // Get primary key
    const pk = await getPrimaryKey(name);

    // Remove AUTO_INCREMENT primary key
    const allowedCols = cols.filter(

      c =>
        c.COLUMN_NAME !== pk ||
        !c.EXTRA.includes("auto_increment")

    );

    // Find fields that exist in request body
    const insertCols = allowedCols

      .filter(
        c => c.COLUMN_NAME in req.body
      )

      .map(
        c => c.COLUMN_NAME
      );


    // No valid fields
    if (insertCols.length === 0) {

      return res.status(400).json({

        error: "No valid fields to insert"

      });

    }


    // Get values
    const values = insertCols.map(

      c => req.body[c]

    );


    // Create ?
    const placeholders = insertCols

      .map(() => "?")

      .join(", ");


    // SQL query
    const sql = `
      INSERT INTO \`${name}\`
      (${insertCols
        .map(c => `\`${c}\``)
        .join(", ")})
      VALUES (${placeholders})
    `;


    await query(sql, values);


    res.json({

      message: "✅ Inserted"

    });


  } catch (e) {

    res.status(500).json({

      error: e.message

    });

  }

});


// ======================================================
// UPDATE RECORD
// ======================================================

app.put("/table/:name/:id", async (req, res) => {

  const { name, id } = req.params;


  // Check table
  if (!isAllowedTable(name)) {

    return res.status(400).json({

      error: "Table not allowed"

    });

  }


  try {

    // Get columns
    const cols = await getColumns(name);

    // Get primary key
    const pk = await getPrimaryKey(name);


    // Remove primary key from update
    const updatable = cols.filter(

      c => c.COLUMN_NAME !== pk

    );


    // Find fields to update
    const selectedCols = updatable

      .filter(
        c => c.COLUMN_NAME in req.body
      );


    // No fields
    if (selectedCols.length === 0) {

      return res.status(400).json({

        error: "No fields to update"

      });

    }


    // SET statements
    const setCols = selectedCols.map(

      c => `\`${c.COLUMN_NAME}\` = ?`

    );


    // Values
    const values = selectedCols.map(

      c => req.body[c.COLUMN_NAME]

    );


    // SQL query
    const sql = `
      UPDATE \`${name}\`
      SET ${setCols.join(", ")}
      WHERE \`${pk}\` = ?
    `;


    await query(

      sql,
      [...values, id]

    );


    res.json({

      message: "✏️ Updated"

    });


  } catch (e) {

    res.status(500).json({

      error: e.message

    });

  }

});


// ======================================================
// DELETE RECORD
// ======================================================

app.delete("/table/:name/:id", async (req, res) => {

  const { name, id } = req.params;


  // Check table
  if (!isAllowedTable(name)) {

    return res.status(400).json({

      error: "Table not allowed"

    });

  }


  try {

    // Get primary key
    const pk = await getPrimaryKey(name);


    // Delete query
    const sql = `
      DELETE FROM \`${name}\`
      WHERE \`${pk}\` = ?
    `;


    await query(sql, [id]);


    res.json({

      message: "🗑️ Deleted"

    });


  } catch (e) {

    res.status(500).json({

      error: e.message

    });

  }

});


// ======================================================
// PATIENTS API
// ======================================================

// Backward compatibility

app.get("/patients", async (_req, res) => {

  try {

    const rows = await query(
      "SELECT * FROM `patient`"
    );

    res.json(rows);

  } catch (e) {

    res.status(500).json({

      error: e.message

    });

  }

});


// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});