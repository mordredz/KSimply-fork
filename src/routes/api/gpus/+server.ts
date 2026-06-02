// src/routes/api/gpus/+server.ts

// [EN] Import SvelteKit's JSON helper and our database helper.
// [IT] Importa l'helper JSON di SvelteKit e il nostro helper per il database.
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/database';

/**
 * [EN] Handles GET requests to fetch and return a sorted list of GPUs.
 * [IT] Gestisce le richieste GET per recuperare e restituire una lista ordinata di GPU.
 */
export async function GET() {
	try {
		const db = getDb();
		const result = await db.execute('SELECT id, name FROM gpus ORDER BY name ASC');
		return json(result.rows);
	} catch (error) {
		console.error('[API /api/gpus] Errore:', error);
		return json({ message: 'Errore nel recuperare la lista delle GPU' }, { status: 500 });
	}
}
