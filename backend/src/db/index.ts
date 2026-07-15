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
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    const columns = await db.query<any>('SHOW COLUMNS FROM users');
    const hasUsername = columns.some((c: any) => c.Field === 'username');
    const hasEmail = columns.some((c: any) => c.Field === 'email');
    if (hasUsername) {
      if (hasEmail) {
        console.log('[Migration] Both username and email columns exist in users. Migrating data...');
        await db.execute('UPDATE users SET email = username WHERE email IS NULL OR email = ""');
        await db.execute('ALTER TABLE users DROP COLUMN username');
        await db.execute('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) UNIQUE NOT NULL');
        console.log('[Migration] Successfully migrated data from users.username to users.email');
      } else {
        console.log('[Migration] Renaming users.username to users.email...');
        await db.execute("ALTER TABLE users CHANGE COLUMN username email VARCHAR(255) UNIQUE NOT NULL");
        console.log('[Migration] users.username successfully renamed to users.email');
      }
    }
  } catch (err: any) {
    console.warn('[Migration] Failed to migrate users table columns:', err?.message);
  }

  try {
    await db.execute('ALTER TABLE users DROP COLUMN role');
  } catch (err: any) {
    // Ignore only "Unknown column" errors — not real schema failures
    if (err?.code !== 'ER_CANT_DROP_FIELD_OR_KEY' && err?.code !== 'ER_BAD_FIELD_ERROR' && !err?.message?.includes("Can't DROP")) {
      console.warn('[Migration] ALTER TABLE users DROP COLUMN role:', err?.message);
    }
  }

  try {
    await db.execute('ALTER TABLE users ADD COLUMN full_name VARCHAR(255) DEFAULT NULL');
  } catch (err: any) {
    if (err?.code !== 'ER_DUP_FIELDNAME') {
      console.warn('[Migration] ALTER TABLE users ADD COLUMN full_name:', err?.message);
    }
  }

  try {
    await db.execute('ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL');
  } catch (err: any) {
    if (err?.code !== 'ER_DUP_FIELDNAME') {
      console.warn('[Migration] ALTER TABLE users ADD COLUMN reset_token:', err?.message);
    }
  }

  try {
    await db.execute('ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP NULL DEFAULT NULL');
  } catch (err: any) {
    if (err?.code !== 'ER_DUP_FIELDNAME') {
      console.warn('[Migration] ALTER TABLE users ADD COLUMN reset_token_expires:', err?.message);
    }
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
      deleted TINYINT DEFAULT 0,
      edited_at TIMESTAMP NULL DEFAULT NULL,
      slack_channel_id VARCHAR(255) DEFAULT NULL,
      slack_message_ts VARCHAR(255) DEFAULT NULL,
      slack_thread_ts VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `);

  try {
    await db.execute('ALTER TABLE chat_messages ADD COLUMN deleted TINYINT DEFAULT 0');
  } catch (err) {}

  try {
    await db.execute('ALTER TABLE chat_messages ADD COLUMN edited_at TIMESTAMP NULL DEFAULT NULL');
  } catch (err) {}

  try {
    await db.execute('ALTER TABLE chat_messages ADD COLUMN slack_channel_id VARCHAR(255) DEFAULT NULL');
  } catch (err) {}

  try {
    await db.execute('ALTER TABLE chat_messages ADD COLUMN slack_message_ts VARCHAR(255) DEFAULT NULL');
  } catch (err) {}

  try {
    await db.execute('ALTER TABLE chat_messages ADD COLUMN slack_thread_ts VARCHAR(255) DEFAULT NULL');
  } catch (err) {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_reactions (
      message_id VARCHAR(255) NOT NULL,
      user_id INT NOT NULL,
      emoji VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slack_processed_events (
      event_id VARCHAR(255) PRIMARY KEY,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id VARCHAR(255) PRIMARY KEY,
      parent_message_id VARCHAR(255) NOT NULL,
      session_id VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_pins (
      session_id VARCHAR(255) NOT NULL,
      message_id VARCHAR(255) NOT NULL,
      pinned_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, message_id),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_bookmarks (
      user_id INT NOT NULL,
      session_id VARCHAR(255) NOT NULL,
      message_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, message_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_reminders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message_id VARCHAR(255) NOT NULL,
      session_id VARCHAR(255) DEFAULT NULL,
      content TEXT DEFAULT NULL,
      remind_at TIMESTAMP NOT NULL,
      notified TINYINT DEFAULT 0,
      email_sent TINYINT DEFAULT 0,
      dismissed TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
    )
  `);

  // Migrate existing chat_reminders table with new columns
  const reminderMigrations = [
    "ALTER TABLE chat_reminders ADD COLUMN session_id VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE chat_reminders ADD COLUMN content TEXT DEFAULT NULL",
    "ALTER TABLE chat_reminders ADD COLUMN notified TINYINT DEFAULT 0",
    "ALTER TABLE chat_reminders ADD COLUMN email_sent TINYINT DEFAULT 0",
    "ALTER TABLE chat_reminders ADD COLUMN dismissed TINYINT DEFAULT 0",
  ];
  for (const sql of reminderMigrations) {
    try { await db.execute(sql); } catch (e: any) {
      if (e?.code !== 'ER_DUP_FIELDNAME') console.warn('[Migration]', sql, e?.message);
    }
  }

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


  await db.execute(`
    CREATE TABLE IF NOT EXISTS slack_files (
      id VARCHAR(255) PRIMARY KEY,
      url_private TEXT NOT NULL,
      url_private_download TEXT,
      name VARCHAR(255),
      mimetype VARCHAR(255),
      size INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Chat message file attachments
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_message_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id VARCHAR(255) NOT NULL,
      file_id VARCHAR(255) NOT NULL,
      file_name VARCHAR(255),
      file_size INT,
      file_type VARCHAR(255),
      url_private TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES slack_files(id) ON DELETE CASCADE
    )
  `);

  // Notifications system
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      read_status TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_read (user_id, read_status, created_at)
    )
  `);

  // Refresh tokens for JWT token rotation
  await db.execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(512) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      revoked TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Login attempts for brute-force protection
  await db.execute(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      ip_address VARCHAR(50) NOT NULL,
      success TINYINT(1) DEFAULT 0,
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email_ip (email, ip_address),
      INDEX idx_attempted_at (attempted_at)
    )
  `);

  try {
    const loginCols = await db.query<any>("SHOW COLUMNS FROM login_attempts LIKE 'username'");
    if (loginCols.length > 0) {
      console.log('[Migration] Renaming login_attempts.username to login_attempts.email...');
      await db.execute("ALTER TABLE login_attempts CHANGE COLUMN username email VARCHAR(255) NOT NULL");
      try {
        await db.execute("ALTER TABLE login_attempts DROP INDEX idx_username_ip");
      } catch (e) {}
      try {
        await db.execute("ALTER TABLE login_attempts ADD INDEX idx_email_ip (email, ip_address)");
      } catch (e) {}
      console.log('[Migration] login_attempts.username successfully renamed to login_attempts.email');
    }
  } catch (err: any) {
    console.warn('[Migration] Failed to migrate login_attempts table:', err?.message);
  }

  // PERF-05: Index for the reminder polling job (runs every 60s)
  try {
    await db.execute('ALTER TABLE chat_reminders ADD INDEX idx_remind_poll (remind_at, dismissed, email_sent)');
  } catch (e: any) {
    // Ignore if index already exists
    if (e?.code !== 'ER_DUP_KEYNAME') console.warn('[Migration] Add remind_at index:', e?.message);
  }

  // Add secondary performance indexes
  const performanceIndexes = [
    { table: 'slack_messages', index: 'idx_slack_msg_chan_created', definition: '(db_user_id, channel_id, created_at)' },
    { table: 'embeddings', index: 'idx_embed_entity', definition: '(user_id, entity_type, entity_id)' },
    { table: 'action_items', index: 'idx_actions_user_status', definition: '(user_id, status)' },
    { table: 'chat_messages', index: 'idx_msg_session_created', definition: '(session_id, created_at)' },
    { table: 'chat_threads', index: 'idx_threads_parent_created', definition: '(parent_message_id, created_at)' },
    { table: 'chat_messages', index: 'idx_msg_slack_chan_ts', definition: '(slack_channel_id, slack_message_ts)' },
    { table: 'chat_reactions', index: 'idx_reactions_msg_user', definition: '(message_id, user_id)' },
    { table: 'tool_executions', index: 'idx_tools_message', definition: '(message_id)' },
    { table: 'refresh_tokens', index: 'idx_tokens_token_user', definition: '(token, user_id)' }
  ];

  for (const idx of performanceIndexes) {
    try {
      await db.execute(`ALTER TABLE ${idx.table} ADD INDEX ${idx.index} ${idx.definition}`);
    } catch (e: any) {
      if (e?.code !== 'ER_DUP_KEYNAME') {
        console.warn(`[Migration] Add index ${idx.index} on ${idx.table}:`, e?.message);
      }
    }
  }

  // Seed default admin user if users is empty
  const userCountResult = await db.query<any>('SELECT COUNT(*) as count FROM users');
  if (userCountResult[0].count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('admin123', salt);
    await db.execute('INSERT INTO users (email, password_hash) VALUES (?, ?)', ['admin@workspace.ai', passwordHash]);
    console.log('Seeded default admin user (admin@workspace.ai / admin123).');
  }

  // Seed default settings for default admin user if they don't have settings
  const adminUser = await db.queryOne<{ id: number }>('SELECT id FROM users WHERE email = ?', ['admin@workspace.ai']);
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

  // HTML to mrkdwn database migration for legacy messages
  try {
    const tablesToMigrate = ['chat_messages', 'chat_threads'];
    for (const tableName of tablesToMigrate) {
      const rows = await db.query<any>(`SELECT id, content FROM ${tableName}`);
      for (const row of rows) {
        if (row.content && (
          row.content.includes('<strong') || row.content.includes('<em') || 
          row.content.includes('<del') || row.content.includes('<u') || 
          row.content.includes('<b>') || row.content.includes('<i>') || 
          row.content.includes('<s>') || row.content.includes('<u>')
        )) {
          const clean = row.content
            .replace(/<\/?strong>/gi, '*')
            .replace(/<\/?b>/gi, '*')
            .replace(/<\/?em>/gi, '_')
            .replace(/<\/?i>/gi, '_')
            .replace(/<\/?del>/gi, '~')
            .replace(/<\/?s>/gi, '~')
            .replace(/<\/?strike>/gi, '~')
            .replace(/<\/?u>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n');
          
          await db.execute(`UPDATE ${tableName} SET content = ? WHERE id = ?`, [clean, row.id]);
          console.log(`[Migration] Migrated message ID ${row.id} in ${tableName} from HTML to mrkdwn.`);
        }
      }
    }
  } catch (migErr) {
    console.error('[Migration] Failed HTML migration:', migErr);
  }
}
