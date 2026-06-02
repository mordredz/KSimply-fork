import { describe, it, expect } from 'vitest';
import { analyzeHardware, type RawDataPayload } from './analyzer';
import type { UserHardware } from './types';

// [EN] Minimal fixture builders so each test only specifies what matters.
// [IT] Costruttori di fixture minimali: ogni test specifica solo ciò che conta.
const hw = (ram: number): UserHardware => ({ gpu: 'Test GPU', vram: 0, ram, storage: 'ssd' });

function model(over: Partial<RawDataPayload['models'][number]> = {}): RawDataPayload['models'][number] {
	return {
		id: 1,
		model_id: 1,
		quantization_id: 1,
		file_size_gb: 4,
		model_name: 'Test Model',
		model_type: 'Image Generation',
		quantization_name: 'FP16',
		quality_score: 100,
		priority: 100,
		repository: 'repo://model',
		...over
	};
}

function vae(over: Partial<RawDataPayload['vaes'][number]> = {}): RawDataPayload['vaes'][number] {
	return {
		id: 1,
		vae_id: 1,
		quantization_id: 1,
		file_size_gb: 1,
		vae_name: 'Test VAE',
		quantization_name: 'FP16',
		quality_score: 100,
		priority: 100,
		compatible_with_model_id: 1,
		repository: 'repo://vae',
		...over
	};
}

function encoder(over: Partial<RawDataPayload['encoders'][number]> = {}): RawDataPayload['encoders'][number] {
	return {
		id: 1,
		encoder_id: 1,
		quantization_id: 1,
		file_size_gb: 1,
		encoder_name: 'Test Encoder',
		quantization_name: 'FP16',
		quality_score: 100,
		priority: 100,
		compatible_with_model_id: 1,
		repository: 'repo://enc',
		...over
	};
}

describe('analyzeHardware', () => {
	it('marks a recipe optimal when it fits entirely in VRAM', () => {
		const data: RawDataPayload = { models: [model({ file_size_gb: 4 })], encoders: [], vaes: [] };
		const results = analyzeHardware(hw(16), { vram_gb: 8 }, data);

		expect(results).toHaveLength(1);
		expect(results[0].level).toBe('optimal');
		// 4 GB * 1.03 safety buffer
		expect(results[0].totalVramCost).toBeCloseTo(4.12, 5);
		expect(results[0].components.vaes).toEqual([]);
	});

	it('falls back to possible when the model needs RAM offload', () => {
		const data: RawDataPayload = { models: [model({ file_size_gb: 10 })], encoders: [], vaes: [] };
		const results = analyzeHardware(hw(32), { vram_gb: 8 }, data);

		expect(results).toHaveLength(1);
		expect(results[0].level).toBe('possible');
	});

	it('drops a recipe entirely when it fits neither VRAM nor RAM offload', () => {
		const data: RawDataPayload = { models: [model({ file_size_gb: 40 })], encoders: [], vaes: [] };
		const results = analyzeHardware(hw(8), { vram_gb: 4 }, data);

		expect(results).toHaveLength(0);
	});

	it('sums two required VAEs (LTX-2 video + audio) into one recipe', () => {
		const data: RawDataPayload = {
			models: [model({ file_size_gb: 10 })],
			encoders: [],
			vaes: [
				vae({ id: 1, vae_id: 1, vae_name: 'Video VAE', file_size_gb: 2 }),
				vae({ id: 2, vae_id: 2, vae_name: 'Audio VAE', file_size_gb: 3 })
			]
		};
		const results = analyzeHardware(hw(64), { vram_gb: 24 }, data);

		expect(results).toHaveLength(1);
		const vaes = results[0].components.vaes;
		expect(vaes).toHaveLength(2);
		expect(vaes.map((v) => v.name).sort()).toEqual(['Audio VAE (FP16)', 'Video VAE (FP16)']);
		// (10 model + 2 + 3 vae) * 1.03
		expect(results[0].totalVramCost).toBeCloseTo(15.45, 5);
	});

	it('keeps single-VAE models on exactly one VAE (no regression)', () => {
		const data: RawDataPayload = {
			models: [model({ file_size_gb: 4 })],
			encoders: [],
			vaes: [vae({ file_size_gb: 1 })]
		};
		const results = analyzeHardware(hw(16), { vram_gb: 8 }, data);

		expect(results[0].components.vaes).toHaveLength(1);
		expect(results[0].totalVramCost).toBeCloseTo(5.15, 5); // (4 + 1) * 1.03
	});

	it('includes every required text encoder in the recipe cost', () => {
		const data: RawDataPayload = {
			models: [model({ file_size_gb: 4 })],
			encoders: [
				encoder({ id: 1, encoder_id: 1, encoder_name: 'CLIP', file_size_gb: 1 }),
				encoder({ id: 2, encoder_id: 2, encoder_name: 'T5', file_size_gb: 2 })
			],
			vaes: []
		};
		const results = analyzeHardware(hw(16), { vram_gb: 16 }, data);

		expect(results[0].components.text_encoders).toHaveLength(2);
		// (4 + 1 + 2) * 1.03
		expect(results[0].totalVramCost).toBeCloseTo(7.21, 5);
	});

	it('prefers the higher-quality model release as the optimal champion', () => {
		const data: RawDataPayload = {
			models: [
				model({ id: 1, file_size_gb: 4, quantization_name: 'FP8', quality_score: 80, priority: 50 }),
				model({ id: 2, file_size_gb: 6, quantization_name: 'FP16', quality_score: 100, priority: 50 })
			],
			encoders: [],
			vaes: []
		};
		const results = analyzeHardware(hw(16), { vram_gb: 16 }, data);

		// Both fit; the champion is chosen by priority then quality, so FP16 wins.
		const optimal = results.filter((r) => r.level === 'optimal');
		expect(optimal).toHaveLength(1);
		expect(optimal[0].quality).toBe(100);
		expect(optimal[0].recipeName).toContain('FP16');
	});
});
