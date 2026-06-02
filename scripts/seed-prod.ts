// [EN] This script seeds the PRODUCTION Turso database from CSV files.
// [IT] Questo script popola il database di PRODUZIONE su Turso a partire dai file CSV.
import { createClient } from '@libsql/client';
import { seedDatabase } from './seed-core';

// [EN] Load environment variables from .env file for local execution.
// [IT] Carica le variabili d'ambiente da file .env per l'esecuzione locale.
import 'dotenv/config';

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;

async function seed() {
	console.log('🌱 Inizio del processo di seeding di PRODUZIONE...');

	if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
		console.error(
			"❌ ERRORE: Le variabili d'ambiente TURSO_DATABASE_URL e TURSO_AUTH_TOKEN devono essere impostate."
		);
		process.exit(1);
	}

	const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
	console.log('🔗 Connessione al database di produzione (Turso) stabilita.');

	await seedDatabase(db);

	console.log('🎉 Processo di seeding di PRODUZIONE completato con successo!');
}

// [EN] Execute the seed function and handle potential errors.
// [IT] Esegue la funzione di seed e gestisce i potenziali errori.
seed().catch((err) => {
	console.error('❌ Errore durante il processo di seeding di produzione:', err);
	process.exit(1);
});
