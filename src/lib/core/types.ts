// [EN] Core data structures shared by the analysis logic.
// [IT] Strutture dati principali condivise dalla logica di analisi.

// --- USER INPUT ---
// [EN] Represents the hardware specifications provided by the user.
// [IT] Rappresenta le specifiche hardware fornite dall'utente.
export interface UserHardware {
	gpu: string;
	gpuFamily?: 'rtx-40' | 'rtx-30' | 'rtx-20' | 'amd-rx-7000' | 'generic';
	vram: number;
	ram: number;
	storage: 'hdd' | 'ssd' | 'nvme';
}
