import mysql from "mysql2/promise";

let pool;

export async function initializeDatabase() {
  const database = process.env.MYSQL_DATABASE || "humanloop";
  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error("MYSQL_DATABASE may contain only letters, numbers, and underscores.");
  }
  const ssl = process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: true } : undefined;
  const connectionOptions = {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    ssl
  };

  try {
    const connection = await mysql.createConnection({ ...connectionOptions, database });
    await connection.query("SELECT 1");
    await connection.end();
  } catch (error) {
    if (error.code !== "ER_BAD_DB_ERROR") throw error;
    const connection = await mysql.createConnection(connectionOptions);
    await connection.query(`CREATE DATABASE \`${database}\``);
    await connection.end();
  }

  pool = mysql.createPool({
    ...connectionOptions,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    ssl
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190),
      phone VARCHAR(50),
      birthday DATE,
      company VARCHAR(150),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try {
    await pool.query("ALTER TABLE contacts ADD COLUMN user_id INT NULL AFTER id");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") throw error;
  }
  try {
    await pool.query("ALTER TABLE contacts ADD INDEX idx_contacts_user_id (user_id)");
  } catch (error) {
    if (error.code !== "ER_DUP_KEYNAME") throw error;
  }
  try {
    await pool.query("ALTER TABLE contacts ADD CONSTRAINT fk_contacts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE");
  } catch (error) {
    if (!["ER_FK_DUP_NAME", "ER_DUP_KEYNAME"].includes(error.code)) throw error;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_notes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      contact_id INT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      meeting_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INT PRIMARY KEY AUTO_INCREMENT,
      contact_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      due_date DATE NOT NULL,
      reason VARCHAR(255),
      status ENUM('pending', 'completed') DEFAULT 'pending',
      completed_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    )
  `);
  try {
    await pool.query("ALTER TABLE reminders ADD COLUMN completed_at DATETIME");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") throw error;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      role ENUM('user', 'assistant') NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_chat_messages_user (user_id, id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_reset_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

export function db() {
  if (!pool) throw new Error("Database has not been initialized.");
  return pool;
}
