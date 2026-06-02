<script lang="ts">
	import * as m from '$paraglide/messages';
	import type { AnalysisResult, AnalysisLevel, AnalysisNote } from '$lib/core/analyzer';
	import HuggingFaceIcon from './HuggingFaceIcon.svelte';

	let { result }: { result: AnalysisResult } = $props();

	// [EN] Style definitions for different analysis levels (Optimal, Possible, etc.).
	// [IT] Definizioni di stile per i diversi livelli di analisi (Ottimale, Possibile, ecc.).
	const levelStyles = {
		optimal: {
			borderColor: 'border-green-500',
			textColor: 'text-green-300',
			badgeBg: 'bg-green-500/20'
		},
		possible: {
			borderColor: 'border-amber-500',
			textColor: 'text-amber-300',
			badgeBg: 'bg-amber-500/20'
		},
		incompatible: {
			borderColor: 'border-red-600',
			textColor: 'text-red-400',
			badgeBg: 'bg-red-500/20'
		}
	};
	const currentStyle = levelStyles[result.level];

	/**
	 * [EN] Returns the translated text for a given analysis level.
	 * [IT] Restituisce il testo tradotto per un dato livello di analisi.
	 */
	function getLevelText(level: AnalysisLevel) {
		switch (level) {
			case 'optimal':
				return m.card_level_optimal();
			case 'possible':
				return m.card_level_possible();
			case 'incompatible':
				return m.card_level_incompatible();
		}
	}

	/**
	 * [EN] Translates an analysis note object by dynamically calling the correct
	 * Paraglide message function with its parameters.
	 * [IT] Traduce un oggetto nota di analisi chiamando dinamicamente la funzione
	 * di messaggio Paraglide corretta con i suoi parametri.
	 */
	function translateNote(note: AnalysisNote): string {
		const messageFunction = m[note.key] as (params: any) => string;
		return messageFunction(note.params || {});
	}

	// [EN] Defines different "flavors" for quantization types to style them.
	// [IT] Definisce diversi "flavor" per i tipi di quantizzazione per stilizzarli.
	type Flavor = 'GGUF' | 'FP16' | 'FP8' | 'FP4' | 'Virtual' | 'Altro';
	const flavorStyles: Record<Flavor, string> = {
		GGUF: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
		FP16: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
		FP8: 'bg-teal-500/20 text-teal-300 border-teal-500/50',
		FP4: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
		Virtual: 'bg-gray-600/20 text-gray-400 border-gray-600/50',
		Altro: 'bg-gray-500/20 text-gray-300 border-gray-500/50'
	};

	/**
	 * [EN] Determines the quantization "flavor" from a string name for styling.
	 * [IT] Determina il "flavor" di quantizzazione da un nome stringa per la stilizzazione.
	 */
	function getQuantizationFlavor(quantName: string): Flavor {
		if (!quantName || quantName === 'N/A') return 'Altro';
		const lower = quantName.toLowerCase();
		if (lower.includes('included')) return 'Virtual';
		if (lower.startsWith('fp16')) return 'FP16';
		if (lower.startsWith('fp8')) return 'FP8';
		if (lower.startsWith('fp4')) return 'FP4';
		if (lower.startsWith('q') && lower.includes('_')) return 'GGUF';
		return 'Altro';
	}

	const modelFlavor = getQuantizationFlavor(result.components.quantization.name);
</script>

<!-- 
  [EN] Displays a single analysis result card.
  It shows the model recipe, compatibility level, resource requirements, and analysis notes.
  ---
  [IT] Mostra una singola card con un risultato dell'analisi.
  Visualizza la ricetta del modello, il livello di compatibilità, i requisiti di risorse e le note di analisi.
-->
<div
	class="hud-panel flex h-full flex-col rounded-lg border border-border bg-surface p-6 shadow-lg transition-all hover:scale-[1.02] hover:shadow-primary-accent/20"
>
	<!-- Header Section -->
	<div class="flex items-start justify-between">
		<div>
			<div class="flex items-center gap-2">
				<h3 class="text-xl font-bold text-primary-text">{result.recipeName}</h3>
				{#if result.repository}
					<a
						href={result.repository}
						target="_blank"
						rel="noopener noreferrer"
						class="text-secondary-text transition-colors hover:text-primary-accent"
						title={m.repository_link_title()}
					>
						<HuggingFaceIcon />
					</a>
				{/if}
			</div>
			<p class="text-sm text-secondary-text">{result.modelType}</p>
		</div>
		<span
			class="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold {currentStyle.badgeBg} {currentStyle.textColor}"
		>
			{getLevelText(result.level)}
		</span>
	</div>

	<!-- Component Tags Section -->
	<div class="mt-3 flex flex-wrap gap-2">
		<a
			href={result.components.model.repository}
			target="_blank"
			rel="noopener noreferrer"
			class="rounded-full border px-2 py-0.5 text-xs {flavorStyles[
				modelFlavor
			]} flex items-center gap-1 hover:border-primary-accent"
			title={m.repository_link_title()}
		>
			<span>{m.card_label_model()} {result.components.quantization.name}</span>
			<HuggingFaceIcon width={12} height={12} />
		</a>
		{#each result.components.text_encoders as encoder (encoder.name)}
			{#if encoder.cost > 0}
				<a
					href={encoder.repository}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-full border px-2 py-0.5 text-xs {flavorStyles[
						getQuantizationFlavor(encoder.quantization)
					]} flex items-center gap-1 hover:border-primary-accent"
					title={m.repository_link_title()}
				>
					<span>{m.card_label_encoder()} {encoder.quantization}</span>
					<HuggingFaceIcon width={12} height={12} />
				</a>
			{/if}
		{/each}
		{#each result.components.vaes as vae (vae.name)}
			{#if vae.cost > 0 && vae.repository}
				<a
					href={vae.repository}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-full border px-2 py-0.5 text-xs {flavorStyles[
						getQuantizationFlavor(vae.quantization)
					]} flex items-center gap-1 hover:border-primary-accent"
					title={m.repository_link_title()}
				>
					<span>{m.card_label_vae()} {vae.quantization}</span>
					<HuggingFaceIcon width={12} height={12} />
				</a>
			{/if}
		{/each}
	</div>

	<!-- Main Stats Section -->
	<div class="mt-4 space-y-3 text-primary-text">
		<div class="flex items-center justify-between">
			<span>{m.card_quality_model()}</span>
			<span class="rounded bg-background/50 px-2 py-1 font-mono">{result.quality} / 100</span>
		</div>
		<div class="flex items-center justify-between">
			<span>{m.card_vram_requirement()}</span>
			<span class="font-mono {currentStyle.textColor}">{result.totalVramCost.toFixed(2)} GB</span>
		</div>
		<div class="flex items-center justify-between">
			<span>{m.card_ram_requirement()}</span>
			<span class="font-mono {currentStyle.textColor}">{result.totalRamCost.toFixed(2)} GB</span>
		</div>
	</div>

	<!-- Composition Breakdown Section -->
	<div class="mt-4 border-t border-border/50 pt-4">
		<h4 class="mb-2 text-sm font-semibold text-secondary-text">{m.card_composition_title()}</h4>
		<div class="space-y-2 text-sm">
			<div class="flex justify-between">
				<span class="text-secondary-text">{result.components.model.name}</span>
				<span class="rounded bg-background/50 px-2 py-1 font-mono"
					>{result.components.model.cost.toFixed(2)} GB</span
				>
			</div>
			<div class="flex justify-between">
				<span class="text-secondary-text"
					>{m.card_precision()} {result.components.quantization.name}</span
				>
			</div>
			{#each result.components.text_encoders as encoder (encoder.name)}
				<div class="flex justify-between">
					<span class="text-secondary-text">{m.card_label_encoder()} {encoder.name}</span>
					<span class="rounded bg-background/50 px-2 py-1 font-mono"
						>{encoder.cost.toFixed(2)} GB</span
					>
				</div>
			{/each}
			{#each result.components.vaes as vae (vae.name)}
				{#if vae.cost > 0}
					<div class="flex justify-between">
						<span class="text-secondary-text">{m.card_label_vae()} {vae.name}</span>
						<span class="rounded bg-background/50 px-2 py-1 font-mono"
							>{vae.cost.toFixed(2)} GB</span
						>
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Analysis Notes Section -->
	<div class="mt-4 flex flex-grow flex-col border-t border-border/50 pt-4">
		<h4 class="mb-2 text-sm font-semibold text-secondary-text">{m.card_analysis_notes()}</h4>
		<ul class="list-inside list-disc space-y-1 text-sm {currentStyle.textColor}">
			{#each result.notes as note}
				<li>{translateNote(note)}</li>
			{/each}
		</ul>
	</div>
</div>
