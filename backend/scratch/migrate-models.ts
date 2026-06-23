import dotenv from 'dotenv';
dotenv.config();
import { db } from '../src/db/index.ts';

async function run() {
  await db.connect();

  // Update model for all users who still have gpt-4o or 1.5 models
  const r1 = await db.execute(
    "UPDATE settings SET value='gemini-2.5-flash' WHERE `key`='openai_model_name' AND (value='gpt-4o' OR value LIKE 'gpt-%' OR value LIKE '%gemini-1.%')"
  );

  // Update base URL for all users who still have the OpenAI base
  const r2 = await db.execute(
    "UPDATE settings SET value='https://generativelanguage.googleapis.com/v1beta/openai' WHERE `key`='openai_api_base' AND value='https://api.openai.com/v1'"
  );

  // Update embedding model for all users who have old embedding models
  const r3 = await db.execute(
    "UPDATE settings SET value='gemini-embedding-2' WHERE `key`='openai_embedding_model_name' AND (value LIKE 'text-embedding-%' OR value='text-embedding-004')"
  );

  console.log('DB settings migrated!');
  console.log('Model rows updated:', r1?.affectedRows);
  console.log('Base URL rows updated:', r2?.affectedRows);
  console.log('Embedding rows updated:', r3?.affectedRows);

  const rows = await db.query<any>(
    "SELECT user_id, `key`, value FROM settings WHERE `key` IN ('openai_model_name','openai_embedding_model_name','openai_api_base')"
  );
  console.log(rows);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
