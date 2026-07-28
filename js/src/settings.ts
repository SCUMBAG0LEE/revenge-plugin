/**
 * Plugin storage shape and default initialisation.
 */
export interface PluginStorage {
	/** Upload endpoint base URL (no trailing slash). */
	serverUrl: string;
	/** Secret bearer token for authentication. */
	apiToken: string;
	/** Files larger than this (in MB) trigger auto-upload. */
	maxFileSizeMB: number;
	/** Whether to auto-upload without prompting. */
	autoUpload: boolean;
}

const DEFAULTS: PluginStorage = {
	serverUrl: "https://megumin.me/grimoire",
	apiToken: "",
	maxFileSizeMB: 10,
	autoUpload: true,
};

/**
 * Ensure every expected key exists in the storage object.
 * Call once during `onLoad`.
 */
export function ensureDefaults(storage: Record<string, unknown>): void {
	for (const [key, value] of Object.entries(DEFAULTS)) {
		if (storage[key] === undefined || storage[key] === null) {
			storage[key] = value;
		}
	}
}
