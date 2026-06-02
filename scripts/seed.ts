// [EN] This script seeds the LOCAL SQLite database (ksimply.db) from CSV files.
// [IT] Questo script popola il database SQLite LOCALE (ksimply.db) a partire dai file CSV.
import { createClient } from '@libsql/client';
import { seedDatabase } from './seed-core';

async function seed() {
	console.log('🌱 Inizio del processo di seeding LOCALE...');
	const db = createClient({ url: 'file:ksimply.db' });
	console.log('🔗 Connessione al database locale (ksimply.db) stabilita.');

	await seedDatabase(db);

	console.log('🎉 Processo di seeding LOCALE completato con successo!');
}

// [EN] Execute the seed function and handle potential errors.
// [IT] Esegue la funzione di seed e gestisce i potenziali errori.
seed().catch((err) => {
	console.error('❌ Errore durante il processo di seeding:', err);
	process.exit(1);
});
