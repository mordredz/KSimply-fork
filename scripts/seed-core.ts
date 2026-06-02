// [EN] Shared seeding logic used by both the local and the production seed scripts.
// Keeping the schema and the insert logic in ONE place prevents local/prod drift.
// [IT] Logica di seeding condivisa usata sia dallo script locale sia da quello di produzione.
// Tenere schema e logica di inserimento in UN SOLO posto evita divergenze locale/prod.
import type { Client } from '@libsql/client';
import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

// [EN] Setup to get the correct directory path in an ES module environment.
// [IT] Setup per ottenere il percorso corretto della directory in un ambiente ES module.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFolderPath = path.join(__dirname, 'data');

// [EN] Tables listed children-first, so they can be dropped without FK conflicts.
// [IT] Tabelle elencate prima le "figlie", così possono essere eliminate senza conflitti di FK.
const TABLES_TO_DROP = [
	'model_encoder_compatibility',
	'model_vae_compatibility',
	'model_releases',
	'text_encoder_releases',
	'vae_releases',
	'gpus',
	'base_models',
	'text_encoders',
	'vaes',
	'quantizations'
];

// [EN] The single source of truth for the database schema. Parent tables first.
// [IT] L'unica fonte di verità per lo schema del database. Prima le tabelle "padre".
const SCHEMA_STATEMENTS = [
	`CREATE TABLE "base_models" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE, "type" TEXT NOT NULL);`,
	`CREATE TABLE "gpus" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE, "vram_gb" INTEGER NOT NULL, "family" TEXT, "fp8_support" TEXT, "fp4_support" TEXT);`,
	`CREATE TABLE "text_encoders" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE);`,
	`CREATE TABLE "vaes" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE);`,
	`CREATE TABLE "quantizations" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE, "quality_score" INTEGER NOT NULL, "priority" INTEGER NOT NULL DEFAULT 0);`,
	`CREATE TABLE "model_encoder_compatibility" ("model_id" INTEGER NOT NULL, "encoder_id" INTEGER NOT NULL, PRIMARY KEY (model_id, encoder_id), FOREIGN KEY(model_id) REFERENCES base_models(id) ON DELETE CASCADE, FOREIGN KEY(encoder_id) REFERENCES text_encoders(id) ON DELETE CASCADE);`,
	`CREATE TABLE "model_releases" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "model_id" INTEGER NOT NULL, "quantization_id" INTEGER NOT NULL, "file_size_gb" REAL NOT NULL, "repository" TEXT, FOREIGN KEY(model_id) REFERENCES base_models(id) ON DELETE CASCADE, FOREIGN KEY(quantization_id) REFERENCES quantizations(id) ON DELETE CASCADE);`,
	`CREATE TABLE "model_vae_compatibility" ("model_id" INTEGER NOT NULL, "vae_id" INTEGER NOT NULL, PRIMARY KEY (model_id, vae_id), FOREIGN KEY(model_id) REFERENCES base_models(id) ON DELETE CASCADE, FOREIGN KEY(vae_id) REFERENCES vaes(id) ON DELETE CASCADE);`,
	`CREATE TABLE "text_encoder_releases" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "encoder_id" INTEGER NOT NULL, "quantization_id" INTEGER NOT NULL, "file_size_gb" REAL NOT NULL, "repository" TEXT, FOREIGN KEY(encoder_id) REFERENCES text_encoders(id) ON DELETE CASCADE, FOREIGN KEY(quantization_id) REFERENCES quantizations(id) ON DELETE CASCADE);`,
	`CREATE TABLE "vae_releases" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "vae_id" INTEGER NOT NULL, "quantization_id" INTEGER NOT NULL, "file_size_gb" REAL NOT NULL, "repository" TEXT, FOREIGN KEY(vae_id) REFERENCES vaes(id) ON DELETE CASCADE, FOREIGN KEY(quantization_id) REFERENCES quantizations(id) ON DELETE CASCADE);`
];

// [EN] CSV sentinel meaning the component is bundled in the model (no separate file to link).
// [IT] Segnaposto CSV: il componente è incluso nel modello (nessun file separato da collegare).
const INCLUDED_IN_MODEL = '(Included in Model)';

/**
 * [EN] A generic utility to parse a CSV file (from scripts/data) into an array of objects.
 * [IT] Una utility generica per parsare un file CSV (da scripts/data) in un array di oggetti.
 */
async function parseCsv<T>(fileName: string): Promise<T[]> {
	const filePath = path.join(dataFolderPath, fileName);
	console.log(`   -> Lettura: ${path.basename(filePath)}`);
	const csvFile = await fs.readFile(filePath, 'utf-8');
	return new Promise((resolve) => {
		Papa.parse<T>(csvFile, {
			header: true,
			dynamicTyping: true,
			skipEmptyLines: true,
			comments: '#',
			complete: (results) => {
				const cleanedData = results.data.filter((item) => item != null);
				resolve(cleanedData);
			}
		});
	});
}

/**
 * [EN] Seeds the given libSQL database (local file or Turso) from the CSV files.
 * Drops and recreates the schema, then loads every table.
 * ---
 * [IT] Popola il database libSQL fornito (file locale o Turso) a partire dai file CSV.
 * Elimina e ricrea lo schema, poi carica ogni tabella.
 */
export async function seedDatabase(db: Client): Promise<void> {
	// [EN] Step 1: Clean up existing tables to ensure a fresh start.
	// [IT] Passo 1: Pulisce le tabelle esistenti per garantire una partenza pulita.
	console.log('🧹 Pulizia delle tabelle...');
	for (const table of TABLES_TO_DROP) {
		try {
			await db.execute(`DROP TABLE ${table};`);
		} catch (error) {
			// [EN] Ignore "table doesn't exist" on a fresh database; rethrow anything else.
			// [IT] Ignora "tabella inesistente" su un database nuovo; rilancia ogni altro errore.
			if (!(error instanceof Error) || !error.message.includes('no such table')) {
				throw error;
			}
		}
	}
	console.log('✅ Tabelle eliminate.');

	// [EN] Step 1.1: Recreate the database schema from scratch.
	// [IT] Passo 1.1: Ricrea lo schema del database da zero.
	console.log('🏗️ Creazione della nuova struttura delle tabelle...');
	await db.batch(SCHEMA_STATEMENTS);
	console.log('✅ Nuova struttura creata.');

	// [EN] Step 2: Load all data from CSV files into memory.
	// [IT] Passo 2: Carica tutti i dati dai file CSV in memoria.
	console.log('🚚 Caricamento dati dai file CSV...');
	const gpus = await parseCsv<any>('gpus.csv');
	const base_models = await parseCsv<any>('base_models.csv');
	const text_encoders = await parseCsv<any>('text_encoders.csv');
	const vaes = await parseCsv<any>('vaes.csv');
	const quantizations = await parseCsv<any>('quantizations.csv');
	const model_releases = await parseCsv<any>('model_releases.csv');
	const text_encoder_releases = await parseCsv<any>('text_encoder_releases.csv');
	const vae_releases = await parseCsv<any>('vae_releases.csv');
	const model_compatibilities = await parseCsv<any>('model_compatibilities.csv');

	// [EN] Step 3: Populate core tables and create name-to-ID maps for later use.
	// [IT] Passo 3: Popola le tabelle principali e crea mappe nome-ID per uso futuro.
	console.log('📝 Inserimento anagrafiche e creazione mappe ID...');
	const nameToIdMaps: { [key: string]: Map<string, number> } = {};
	const anagrafiche = [
		{ name: 'gpus', data: gpus, cols: 'name, vram_gb, family, fp8_support, fp4_support' },
		{ name: 'base_models', data: base_models, cols: 'name, type' },
		{ name: 'text_encoders', data: text_encoders, cols: 'name' },
		{ name: 'vaes', data: vaes, cols: 'name' },
		{ name: 'quantizations', data: quantizations, cols: 'name, quality_score, priority' }
	];

	for (const anag of anagrafiche) {
		for (const item of anag.data) {
			if (item) {
				const keys = Object.keys(item).filter((k) => anag.cols.includes(k));
				const insertStmt = `INSERT INTO ${anag.name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
				const insertVals = keys.map((k) => item[k]);
				await db.execute({ sql: insertStmt, args: insertVals });
			}
		}

		const itemsFromDb = await db.execute(`SELECT id, name FROM ${anag.name}`);
		nameToIdMaps[anag.name] = new Map(itemsFromDb.rows.map((i: any) => [i.name, i.id]));
		console.log(`   -> Inseriti ${itemsFromDb.rows.length} record in ${anag.name}.`);
	}

	// [EN] Step 4: Populate "release" tables, using the maps to link foreign keys.
	// [IT] Passo 4: Popola le tabelle "release", usando le mappe per collegare le chiavi esterne.
	console.log('📦 Inserimento delle versioni specifiche (releases)...');
	for (const release of model_releases) {
		if (release && release.model_name) {
			await db.execute({
				sql: 'INSERT INTO model_releases (model_id, quantization_id, file_size_gb, repository) VALUES (?, ?, ?, ?)',
				args: [nameToIdMaps['base_models'].get(release.model_name), nameToIdMaps['quantizations'].get(release.quantization_name), release.file_size_gb, release.repository]
			});
		}
	}
	console.log(`   -> Inserite ${model_releases.length} versioni di modelli.`);
	for (const release of text_encoder_releases) {
		if (release && release.encoder_name) {
			await db.execute({
				sql: 'INSERT INTO text_encoder_releases (encoder_id, quantization_id, file_size_gb, repository) VALUES (?, ?, ?, ?)',
				args: [nameToIdMaps['text_encoders'].get(release.encoder_name), nameToIdMaps['quantizations'].get(release.quantization_name), release.file_size_gb, release.repository]
			});
		}
	}
	console.log(`   -> Inserite ${text_encoder_releases.length} versioni di text encoder.`);
	for (const release of vae_releases) {
		if (release && release.vae_name) {
			await db.execute({
				sql: 'INSERT INTO vae_releases (vae_id, quantization_id, file_size_gb, repository) VALUES (?, ?, ?, ?)',
				args: [nameToIdMaps['vaes'].get(release.vae_name), nameToIdMaps['quantizations'].get(release.quantization_name), release.file_size_gb, release.repository]
			});
		}
	}
	console.log(`   -> Inserite ${vae_releases.length} versioni di VAE.`);

	// [EN] Step 5: Populate join tables to create compatibility relationships.
	// [IT] Passo 5: Popola le tabelle di giunzione per creare le relazioni di compatibilità.
	console.log('🔗 Creazione dei collegamenti di compatibilità...');
	for (const comp of model_compatibilities) {
		if (comp && comp.model_name) {
			const modelId = nameToIdMaps['base_models'].get(comp.model_name);
			if (!modelId) {
				console.warn(`   -> ERRORE: Modello base "${comp.model_name}" non trovato!`);
				continue;
			}
			for (const rawName of comp.compatible_text_encoders.split('|')) {
				const teName = rawName.trim();
				// [EN] Sentinel: the encoder ships inside the model, so there is no separate row to link.
				// [IT] Segnaposto: l'encoder è incluso nel modello, quindi non c'è una riga separata da collegare.
				if (teName === INCLUDED_IN_MODEL) continue;
				const teId = nameToIdMaps['text_encoders'].get(teName);
				if (teId) {
					await db.execute({ sql: 'INSERT OR IGNORE INTO model_encoder_compatibility (model_id, encoder_id) VALUES (?, ?)', args: [modelId, teId] });
				} else {
					console.warn(`   -> ERRORE: Text Encoder "${teName}" non trovato (modello "${comp.model_name}")!`);
				}
			}
			for (const rawName of comp.compatible_vaes.split('|')) {
				const vaeName = rawName.trim();
				if (vaeName === INCLUDED_IN_MODEL) continue;
				const vaeId = nameToIdMaps['vaes'].get(vaeName);
				if (vaeId) {
					await db.execute({ sql: 'INSERT OR IGNORE INTO model_vae_compatibility (model_id, vae_id) VALUES (?, ?)', args: [modelId, vaeId] });
				} else {
					console.warn(`   -> ERRORE: VAE "${vaeName}" non trovato (modello "${comp.model_name}")!`);
				}
			}
		}
	}
	console.log('✅ Collegamenti creati con successo.');
}
