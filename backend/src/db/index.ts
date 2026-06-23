import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

class MySQLDatabase {
  private pool: mysql.Pool | null = null;

  async connect() {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = parseInt(process.env.MYSQL_PORT || '3306');
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'slack_ai_assistant';

    try {
      // 1. Create connection without database to ensure DB exists
      const tempConnection = await mysql.createConnection({ host, port, user, password });
      await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
      await tempConnection.end();

      // 2. Create the pool
      this.pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
    } catch (err) {
      console.error('MySQL connection failed. Ensure local MySQL is running.', err);
      throw err;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.pool) await this.connect();
    const [result] = await this.pool!.execute(sql, params);
    return result;
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const rows = await this.execute(sql, params);
    return rows as T[];
  }

  async queryOne<T>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
}

export const db = new MySQLDatabase();

export async function initializeDatabase() {
  await db.connect();

  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await db.execute('ALTER TABLE users DROP COLUMN role');
  } catch (err) {
    // Ignore error if column already dropped
  }

  try {
    await db.execute('ALTER TABLE users ADD COLUMN full_name VARCHAR(255) DEFAULT NULL');
  } catch (err) {
    // Ignore error if column already exists
  }



  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id VARCHAR(255) PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      reasoning TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `);

  // Drop old slack tables if they do not contain db_user_id column
  try {
    const columns = await db.query<any>('DESCRIBE slack_channels');
    const hasDbUserId = columns.some((c: any) => c.Field === 'db_user_id');
    if (!hasDbUserId) {
      console.log('Migrating slack tables (dropping old schemas)...');
      await db.execute('DROP TABLE IF EXISTS slack_threads');
      await db.execute('DROP TABLE IF EXISTS slack_messages');
      await db.execute('DROP TABLE IF EXISTS slack_channels');
    }
  } catch (e) {
    // Tables don't exist yet, ignore
  }

  // Drop old saved_reports table if it does not contain user_id column
  try {
    const columns = await db.query<any>('DESCRIBE saved_reports');
    const hasUserId = columns.some((c: any) => c.Field === 'user_id');
    if (!hasUserId) {
      console.log('Migrating saved_reports table (dropping old schema)...');
      await db.execute('DROP TABLE IF EXISTS saved_reports');
    }
  } catch (e) {
    // Table doesn't exist yet, ignore
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_reports (
      user_id INT NOT NULL,
      id VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      channel_id VARCHAR(255),
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slack_channels (
      db_user_id INT NOT NULL,
      id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      is_private INT DEFAULT 0,
      topic TEXT,
      purpose TEXT,
      member_count INT DEFAULT 0,
      last_synced_at TIMESTAMP NULL,
      PRIMARY KEY (db_user_id, id),
      FOREIGN KEY (db_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slack_messages (
      db_user_id INT NOT NULL,
      id VARCHAR(255) NOT NULL,
      channel_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      text TEXT NOT NULL,
      thread_ts VARCHAR(255),
      reply_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (db_user_id, id),
      FOREIGN KEY (db_user_id, channel_id) REFERENCES slack_channels(db_user_id, id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slack_threads (
      db_user_id INT NOT NULL,
      id VARCHAR(255) NOT NULL,
      channel_id VARCHAR(255) NOT NULL,
      root_message_text TEXT NOT NULL,
      summary TEXT NOT NULL,
      analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (db_user_id, id),
      FOREIGN KEY (db_user_id, channel_id) REFERENCES slack_channels(db_user_id, id) ON DELETE CASCADE
    )
  `);

  // Drop old embeddings table if it does not contain user_id column
  try {
    const columns = await db.query<any>('DESCRIBE embeddings');
    const hasUserId = columns.some((c: any) => c.Field === 'user_id');
    if (!hasUserId) {
      console.log('Migrating embeddings table (dropping old schema)...');
      await db.execute('DROP TABLE IF EXISTS embeddings');
    }
  } catch (e) {
    // Table doesn't exist yet, ignore
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);


  // Drop old settings table if it does not contain user_id column
  try {
    const columns = await db.query<any>('DESCRIBE settings');
    const hasUserId = columns.some((c: any) => c.Field === 'user_id');
    if (!hasUserId) {
      console.log('Migrating settings table (dropping old schema)...');
      await db.execute('DROP TABLE settings');
    }
  } catch (e) {
    // Table doesn't exist yet, ignore
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id INT NOT NULL,
      \`key\` VARCHAR(255) NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, \`key\`),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action VARCHAR(255) NOT NULL,
      target VARCHAR(255),
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tool_executions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id VARCHAR(255),
      tool_name VARCHAR(255) NOT NULL,
      arguments TEXT,
      result TEXT,
      status VARCHAR(50) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS action_items (
      id VARCHAR(255) PRIMARY KEY,
      user_id INT NOT NULL,
      channel_id VARCHAR(255) NOT NULL,
      channel_name VARCHAR(255) DEFAULT '',
      task TEXT NOT NULL,
      owner VARCHAR(255) DEFAULT 'Unassigned',
      status VARCHAR(50) DEFAULT 'pending',
      due_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);


  // Seed default admin user if users is empty
  const userCountResult = await db.query<any>('SELECT COUNT(*) as count FROM users');
  if (userCountResult[0].count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('admin123', salt);
    await db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['admin', passwordHash]);
    console.log('Seeded default admin user (admin / admin123).');
  }

  // Seed default settings for default admin user if they don't have settings
  const adminUser = await db.queryOne<{ id: number }>('SELECT id FROM users WHERE username = ?', ['admin']);
  if (adminUser) {
    const settingsCountResult = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM settings WHERE user_id = ?', [adminUser.id]);
    if (!settingsCountResult || settingsCountResult.count === 0) {
      const defaultSettings = [
        { key: 'mcp_server_url', value: '' },
        { key: 'mcp_slack_bot_token', value: '' },
        { key: 'mcp_slack_team_id', value: 'T0BC5R60JJG' },
        { key: 'openai_api_key', value: '' },
        { key: 'openai_model_name', value: 'gemini-2.5-flash' },
        { key: 'openai_api_base', value: 'https://generativelanguage.googleapis.com/v1beta/openai' },
        { key: 'openai_embedding_model_name', value: 'gemini-embedding-2' },
        { key: 'report_schedule', value: 'daily' }
      ];

      for (const s of defaultSettings) {
        await db.execute('INSERT IGNORE INTO settings (user_id, `key`, value) VALUES (?, ?, ?)', [adminUser.id, s.key, s.value]);
      }
      console.log('Seeded default configuration settings for admin user.');
    }
  }
}
