// ======================================================
// HOSPITAL MANAGEMENT SYSTEM - SERVER
// ======================================================

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
// CONFIGURATION
// ======================================================

const PORT = process.env.PORT || 5000;
const DB_NAME = process.env.DB_NAME || "hospital_db";

// ======================================================
// ALLOWED TABLES
// ======================================================

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

const LABEL_FIELDS = {
    patient: "patient_name",
    doctor: "doctor_name",
    department: "department_name",
    staff: "staff_name",
    medicine: "medicine_name",
    room: "room_no"
};

// ======================================================
// CHECK ALLOWED TABLE
// ======================================================

function isAllowedTable(name) {
    return ALLOWED_TABLES.includes(name);
}

// ======================================================
// DATABASE QUERY HELPER
// ======================================================

function query(sql, params = []) {
    return new Promise((resolve, reject) => {

        connection.query(sql, params, (error, rows) => {

            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });

    });
}

// ======================================================
// HOME PAGE
// ======================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(process.cwd(), "index.html")
    );

});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/health", (req, res) => {

    res.json({
        status: "OK",
        message: "Hospital Management Server is running"
    });

});

app.get("/api/health", (req, res) => {

    res.json({
        status: "OK",
        message: "Hospital Management API is running"
    });

});

// ======================================================
// GET ALL TABLES
// ======================================================

function getTables(req, res) {

    res.json(ALLOWED_TABLES);

}

app.get("/tables", getTables);
app.get("/api/tables", getTables);

// ======================================================
// GET PRIMARY KEY
// ======================================================

async function getPrimaryKey(table) {

    const sql = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_KEY = 'PRI'
        ORDER BY ORDINAL_POSITION
        LIMIT 1
    `;

    const rows = await query(sql, [
        DB_NAME,
        table
    ]);

    return rows[0]?.COLUMN_NAME || null;
}

// ======================================================
// GET TABLE COLUMNS
// ======================================================

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

    return await query(sql, [
        DB_NAME,
        table
    ]);

}

// ======================================================
// COLUMN API
//
// IMPORTANT:
// This fixes:
// GET /api/column/patient
// ======================================================

async function columnHandler(req, res) {

    const table =
        req.params.table || req.params.name;

    if (!isAllowedTable(table)) {

        return res.status(400).json({
            error: "Table not allowed"
        });

    }

    try {

        const cols = await getColumns(table);
        const pk = await getPrimaryKey(table);

        const result = cols.map(col => {

            return {
                name: col.COLUMN_NAME,
                type: col.DATA_TYPE,
                nullable: col.IS_NULLABLE === "YES",
                key: col.COLUMN_KEY,
                extra: col.EXTRA,
                isPrimary: col.COLUMN_NAME === pk
            };

        });

        res.json(result);

    } catch (error) {

        console.error(
            "Column error:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

}

// New frontend/API route
app.get(
    "/api/column/:table",
    columnHandler
);

// Existing route
app.get(
    "/table/:name/columns",
    columnHandler
);

// Additional API route
app.get(
    "/api/table/:name/columns",
    columnHandler
);

// ======================================================
// GET ALL RECORDS
// ======================================================

async function getTableHandler(req, res) {

    const table = req.params.name;

    if (!isAllowedTable(table)) {

        return res.status(400).json({
            error: "Table not allowed"
        });

    }

    try {

        const rows = await query(
            `SELECT * FROM \`${table}\``
        );

        res.json(rows);

    } catch (error) {

        console.error(
            "Get table error:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

}

app.get(
    "/table/:name",
    getTableHandler
);

app.get(
    "/api/table/:name",
    getTableHandler
);

// ======================================================
// LOOKUP DATA
// ======================================================

async function lookupHandler(req, res) {

    const table = req.params.table;

    if (!isAllowedTable(table)) {

        return res.status(400).json({
            error: "Table not allowed"
        });

    }

    try {

        const pk =
            await getPrimaryKey(table);

        if (!pk) {

            return res.status(400).json({
                error: `Primary key not found for table ${table}`
            });

        }

        const label =
            LABEL_FIELDS[table] || pk;

        const columns =
            await getColumns(table);

        const labelExists =
            columns.some(
                col => col.COLUMN_NAME === label
            );

        const actualLabel =
            labelExists ? label : pk;

        const rows = await query(
            `
            SELECT
                \`${pk}\` AS id,
                \`${actualLabel}\` AS label
            FROM \`${table}\`
            `
        );

        res.json(rows);

    } catch (error) {

        console.error(
            "Lookup error:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

}

app.get(
    "/lookup/:table",
    lookupHandler
);

app.get(
    "/api/lookup/:table",
    lookupHandler
);

// ======================================================
// INSERT NEW RECORD
// ======================================================

async function insertHandler(req, res) {

    const table = req.params.name;

    if (!isAllowedTable(table)) {

        return res.status(400).json({
            error: "Table not allowed"
        });

    }

    try {

        console.log(
            `INSERT request for ${table}:`,
            req.body
        );

        const cols =
            await getColumns(table);

        const pk =
            await getPrimaryKey(table);

        // Remove auto-increment primary key
        const allowedCols =
            cols.filter(col => {

                if (
                    col.COLUMN_NAME === pk &&
                    col.EXTRA.includes("auto_increment")
                ) {
                    return false;
                }

                return true;

            });

        // Find columns supplied by frontend
        const insertCols =
            allowedCols
                .filter(
                    col =>
                        Object.prototype.hasOwnProperty.call(
                            req.body,
                            col.COLUMN_NAME
                        )
                )
                .map(
                    col => col.COLUMN_NAME
                );

        if (insertCols.length === 0) {

            return res.status(400).json({
                error: "No valid fields to insert",
                receivedData: req.body,
                availableColumns:
                    allowedCols.map(
                        c => c.COLUMN_NAME
                    )
            });

        }

        const values =
            insertCols.map(
                col => req.body[col]
            );

        const placeholders =
            insertCols
                .map(() => "?")
                .join(", ");

        const columnNames =
            insertCols
                .map(
                    col => `\`${col}\``
                )
                .join(", ");

        const sql = `
            INSERT INTO \`${table}\`
            (${columnNames})
            VALUES (${placeholders})
        `;

        console.log(
            "INSERT SQL:",
            sql
        );

        console.log(
            "INSERT VALUES:",
            values
        );

        const result =
            await query(sql, values);

        res.status(201).json({

            message: "Record inserted successfully",

            insertId:
                result.insertId || null

        });

    } catch (error) {

        console.error(
            "INSERT ERROR:",
            error
        );

        res.status(500).json({

            error: error.message

        });

    }

}

app.post(
    "/table/:name",
    insertHandler
);

app.post(
    "/api/table/:name",
    insertHandler
);

// ======================================================
// UPDATE RECORD
// ======================================================

async function updateHandler(req, res) {

    const table =
        req.params.name;

    const id =
        req.params.id;

    if (!isAllowedTable(table)) {

        return res.status(400).json({
            error: "Table not allowed"
        });

    }

    try {

        const cols =
            await getColumns(table);

        const pk =
            await getPrimaryKey(table);

        if (!pk) {

            return res.status(400).json({
                error: "Primary key not found"
            });

        }

        const updateCols =
            cols.filter(col => {

                return (
                    col.COLUMN_NAME !== pk &&
                    Object.prototype.hasOwnProperty.call(
                        req.body,
                        col.COLUMN_NAME
                    )
                );

            });

        if (updateCols.length === 0) {

            return res.status(400).json({
                error: "No fields to update"
            });

        }

        const setStatements =
            updateCols.map(
                col =>
                    `\`${col.COLUMN_NAME}\` = ?`
            );

        const values =
            updateCols.map(
                col =>
                    req.body[col.COLUMN_NAME]
            );

        values.push(id);

        const sql = `
            UPDATE \`${table}\`
            SET ${setStatements.join(", ")}
            WHERE \`${pk}\` = ?
        `;

        await query(
            sql,
            values
        );

        res.json({

            message:
                "Record updated successfully"

        });

    } catch (error) {

        console.error(
            "UPDATE ERROR:",
            error
        );

        res.status(500).json({

            error: error.message

        });

    }

}

app.put(
    "/table/:name/:id",
    updateHandler
);

app.put(
    "/api/table/:name/:id",
    updateHandler
);

// ======================================================
// DELETE RECORD
// ======================================================

async function deleteHandler(req, res) {

    const table =
        req.params.name;

    const id =
        req.params.id;

    if (!isAllowedTable(table)) {

        return res.status(400).json({
            error: "Table not allowed"
        });

    }

    try {

        const pk =
            await getPrimaryKey(table);

        if (!pk) {

            return res.status(400).json({
                error: "Primary key not found"
            });

        }

        const sql = `
            DELETE FROM \`${table}\`
            WHERE \`${pk}\` = ?
        `;

        const result =
            await query(
                sql,
                [id]
            );

        res.json({

            message:
                "Record deleted successfully",

            affectedRows:
                result.affectedRows

        });

    } catch (error) {

        console.error(
            "DELETE ERROR:",
            error
        );

        res.status(500).json({

            error: error.message

        });

    }

}

app.delete(
    "/table/:name/:id",
    deleteHandler
);

app.delete(
    "/api/table/:name/:id",
    deleteHandler
);

// ======================================================
// PATIENTS API
// ======================================================

async function patientsHandler(req, res) {

    try {

        const rows =
            await query(
                "SELECT * FROM `patient`"
            );

        res.json(rows);

    } catch (error) {

        console.error(
            "Patients error:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

}

app.get(
    "/patients",
    patientsHandler
);

app.get(
    "/api/patients",
    patientsHandler
);

// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {

    console.log(
        "404 REQUEST:",
        req.method,
        req.originalUrl
    );

    res.status(404).json({

        error: "Route not found",

        method:
            req.method,

        path:
            req.originalUrl

    });

});

// ======================================================
// ERROR HANDLER
// ======================================================

app.use((error, req, res, next) => {

    console.error(
        "SERVER ERROR:",
        error
    );

    res.status(500).json({

        error:
            error.message || "Internal Server Error"

    });

});

// ======================================================
// START SERVER
// ======================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 Server running on port ${PORT}`
        );

        console.log(
            `📊 Database: ${DB_NAME}`
        );

        console.log(
            "✅ Hospital Management API ready"
        );

    }
);