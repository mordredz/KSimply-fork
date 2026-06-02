// src/routes/api/analyze/+server.ts

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import type { Row } from '@libsql/client';
import { getDb } from '$lib/server/database';
import { analyzeHardware, type RawDataPayload } from '$lib/core/analyzer';
import type { UserHardware } from '$lib/core/types';

// [EN] In-memory cache for the (static) catalog queries. On a warm serverless
// instance this avoids re-querying the DB on every analysis request.
// [IT] Cache in-memory per le query (statiche) del catalogo. Su un'istanza
// serverless "calda" evita di re-interrogare il DB ad ogni richiesta di analisi.
let cachedModelsData: Row[] | null = null;
let cachedEncodersData: Row[] | null = null;
let cachedVaesData: Row[] | null = null;

/**
 * [EN] Handles POST requests containing user hardware data for analysis.
 * [IT] Gestisce le richieste POST contenenti i dati hardware dell'utente per l'analisi.
 */
export const POST: RequestHandler = async ({ request }) => {
	const hardwareData: UserHardware = await request.json();

	try {
		const db = getDb();

		// [EN] Fetch specific info for the user's selected GPU.
		// [IT] Recupera le informazioni specifiche per la GPU selezionata.
		const gpuResult = await db.execute({
			sql: 'SELECT * FROM gpus WHERE name = ? COLLATE NOCASE',
			args: [hardwareData.gpu]
		});
		const gpuInfo = gpuResult.rows[0];

		if (!gpuInfo) {
			return json({ success: false, message: 'GPU non trovata' }, { status: 404 });
		}

		// [EN] Fetch the catalog once, then reuse it from the in-memory cache.
		// [IT] Recupera il catalogo una volta, poi lo riusa dalla cache in-memory.
		if (!cachedModelsData || !cachedEncodersData || !cachedVaesData) {
			console.log('CACHE MISS - Esecuzione delle query al database...');
			const modelsSql = `
				SELECT mr.*, bm.name as model_name, bm.type as model_type, q.name as quantization_name, q.quality_score, q.priority, mr.repository
				FROM model_releases mr
				JOIN base_models bm ON mr.model_id = bm.id
				JOIN quantizations q ON mr.quantization_id = q.id
			`;
			cachedModelsData = (await db.execute(modelsSql)).rows;

			const encodersSql = `
				SELECT ter.*, te.name as encoder_name, q.name as quantization_name, q.quality_score, q.priority, mec.model_id as compatible_with_model_id, ter.repository
				FROM text_encoder_releases ter
				JOIN text_encoders te ON ter.encoder_id = te.id
				JOIN quantizations q ON ter.quantization_id = q.id
				JOIN model_encoder_compatibility mec ON te.id = mec.encoder_id
			`;
			cachedEncodersData = (await db.execute(encodersSql)).rows;

			const vaesSql = `
				SELECT vr.*, v.name as vae_name, q.name as quantization_name, q.quality_score, q.priority, mvc.model_id as compatible_with_model_id, vr.repository
				FROM vae_releases vr
				JOIN vaes v ON vr.vae_id = v.id
				JOIN quantizations q ON vr.quantization_id = q.id
				JOIN model_vae_compatibility mvc ON v.id = mvc.vae_id
			`;
			cachedVaesData = (await db.execute(vaesSql)).rows;
		} else {
			console.log('CACHE HIT - Utilizzo dei dati dalla cache.');
		}

		// [EN] Call the core analysis logic with the user's hardware and all fetched data.
		// [IT] Chiama la logica di analisi principale con l'hardware dell'utente e tutti i dati recuperati.
		const analysisResults = analyzeHardware(
			hardwareData,
			{ vram_gb: Number(gpuInfo.vram_gb) },
			{
				models: cachedModelsData as unknown as RawDataPayload['models'],
				encoders: cachedEncodersData as unknown as RawDataPayload['encoders'],
				vaes: cachedVaesData as unknown as RawDataPayload['vaes']
			}
		);

		return json({ success: true, gpu: gpuInfo, analysis: analysisResults });
	} catch (error) {
		console.error("[API /api/analyze] Errore catturato durante l'analisi:", error);
		return json({ success: false, message: 'Errore interno del server' }, { status: 500 });
	}
};
