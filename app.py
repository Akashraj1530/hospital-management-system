from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

dbconfig = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "akash@123"),
    "database": os.getenv("DB_NAME", "hospital_db"),
}

# Connection pool (better than single connection)
pool = pooling.MySQLConnectionPool(pool_name="hospital_pool", pool_size=5, **dbconfig)

def query(sql, params=None, fetch="all"):
    conn = pool.get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params or ())
        if sql.strip().lower().startswith(("insert", "update", "delete")):
            conn.commit()
        if fetch == "one":
            return cur.fetchone()
        if fetch == "all":
            return cur.fetchall()
        return None
    finally:
        cur.close()
        conn.close()

@app.get("/api/health")
def health():
    return {"status": "ok"}

# -------- Patients --------
@app.get("/api/patients")
def get_patients():
    rows = query("SELECT * FROM patient")
    return jsonify(rows)

@app.post("/api/patients")
def add_patient():
    data = request.get_json(force=True)
    sql = """
      INSERT INTO patient (patient_name, gender, age, phone)
      VALUES (%s, %s, %s, %s)
    """
    params = (data.get("patient_name"), data.get("gender"), data.get("age"), data.get("phone"))
    query(sql, params, fetch=None)
    # Return the newly inserted record (simple approach: last row by id)
    row = query("SELECT * FROM patient ORDER BY patient_id DESC LIMIT 1", fetch="one")
    return jsonify(row), 201

# -------- Doctors --------
@app.get("/api/doctors")
def get_doctors():
    rows = query("SELECT * FROM doctor")
    return jsonify(rows)

# -------- Appointments (join example) --------
@app.get("/api/appointments")
def get_appointments():
    sql = """
    SELECT a.appointment_id, a.appointment_date,
           p.patient_id, p.patient_name,
           d.doctor_id, d.doctor_name, d.specialization
    FROM appointment a
    JOIN patient p ON a.patient_id = p.patient_id
    JOIN doctor d  ON a.doctor_id = d.doctor_id
    ORDER BY a.appointment_date
    """
    rows = query(sql)
    return jsonify(rows)

@app.post("/api/appointments")
def add_appointment():
    data = request.get_json(force=True)
    sql = """
      INSERT INTO appointment (patient_id, doctor_id, appointment_date)
      VALUES (%s, %s, %s)
    """
    params = (data.get("patient_id"), data.get("doctor_id"), data.get("appointment_date"))
    query(sql, params)
    row = query("""
      SELECT a.appointment_id, a.appointment_date,
             p.patient_id, p.patient_name,
             d.doctor_id, d.doctor_name, d.specialization
      FROM appointment a
      JOIN patient p ON a.patient_id = p.patient_id
      JOIN doctor d  ON a.doctor_id = d.doctor_id
      ORDER BY a.appointment_id DESC LIMIT 1
    """, fetch="one")
    return jsonify(row), 201

# -------- Billing --------
@app.get("/api/billing")
def get_billing():
    sql = """
    SELECT b.bill_id, b.amount, b.bill_date,
           p.patient_id, p.patient_name
    FROM billing b
    JOIN patient p ON b.patient_id = p.patient_id
    ORDER BY b.bill_date DESC
    """
    rows = query(sql)
    return jsonify(rows)

@app.post("/api/billing")
def add_bill():
    data = request.get_json(force=True)
    sql = """
      INSERT INTO billing (patient_id, amount, bill_date)
      VALUES (%s, %s, %s)
    """
    params = (data.get("patient_id"), data.get("amount"), data.get("bill_date"))
    query(sql, params)
    row = query("""
      SELECT b.bill_id, b.amount, b.bill_date,
             p.patient_id, p.patient_name
      FROM billing b
      JOIN patient p ON b.patient_id = p.patient_id
      ORDER BY b.bill_id DESC LIMIT 1
    """, fetch="one")
    return jsonify(row), 201

# -------- Departments, Rooms, Staff, Medicine (read-only examples) --------
@app.get("/api/departments")
def departments():
    return jsonify(query("SELECT * FROM department"))

@app.get("/api/rooms")
def rooms():
    return jsonify(query("SELECT * FROM room"))

@app.get("/api/staff")
def staff():
    return jsonify(query("SELECT * FROM staff"))

@app.get("/api/medicines")
def medicines():
    return jsonify(query("SELECT * FROM medicine"))

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=bool(int(os.getenv("FLASK_DEBUG", "1"))))
