// src/lib/server/database.ts

// [EN] We use the same libSQL client everywhere: it talks to Turso in production
// and opens the local SQLite file (`file:`) in development. One driver, one API.
// [IT] Usiamo lo stesso client libSQL ovunque: parla con Turso in produzione e
// apre il file SQLite locale (`file:`) in sviluppo. Un solo driver, una sola API.
import { createClient, type Client } from '@libsql/client';

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, VERCEL_ENV } = process.env;

// [EN] Reliably detect if the app is running in a Vercel production environment.
// [IT] Rileva in modo affidabile se l'app è in esecuzione in un ambiente di produzione Vercel.
const isProduction = VERCEL_ENV === 'production';

// [EN] A singleton instance to hold the database connection client.
// [IT] Un'istanza singleton per mantenere il client di connessione al database.
let db: Client | undefined;

/**
 * [EN] Database connection helper (singleton).
 * In production it connects to Turso; in development it opens the local SQLite
 * file. Both paths return the same libSQL `Client`, so callers use one API
 * (`db.execute(...)` → `result.rows`) regardless of the environment.
 * ---
 * [IT] Helper per la connessione al database (singleton).
 * In produzione si connette a Turso; in sviluppo apre il file SQLite locale.
 * Entrambi i percorsi restituiscono lo stesso `Client` libSQL, così i chiamanti
 * usano un'unica API (`db.execute(...)` → `result.rows`) a prescindere dall'ambiente.
 */
export function getDb(): Client {
	if (db) return db;

	if (isProduction) {
		// --- PRODUCTION ENVIRONMENT (Vercel + Turso) ---
		if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
			throw new Error('Database environment variables are not set in production.');
		}
		db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
	} else {
		// --- DEVELOPMENT ENVIRONMENT (local SQLite file) ---
		db = createClient({ url: 'file:ksimply.db' });
	}

	return db;
}
