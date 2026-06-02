// src/routes/api/models/+server.ts

// [EN] Import SvelteKit's JSON helper and our database helper.
// [IT] Importa l'helper JSON di SvelteKit e il nostro helper per il database.
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/database';

/**
 * [EN] Handles GET requests to fetch and return a sorted list of base model names.
 * [IT] Gestisce le richieste GET per recuperare e restituire una lista ordinata di nomi di modelli base.
 */
export async function GET() {
	try {
		const db = getDb();
		const result = await db.execute('SELECT name FROM base_models ORDER BY name ASC');

		// [EN] Extract just the name from each row object.
		// [IT] Estrae solo il nome da ogni oggetto riga.
		const modelNames = result.rows.map((row) => row.name as string);
		return json(modelNames);
	} catch (error) {
		console.error('[API /api/models] Errore:', error);
		return json({ message: 'Errore nel recuperare la lista dei modelli' }, { status: 500 });
	}
}
