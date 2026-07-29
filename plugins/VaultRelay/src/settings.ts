/**
 * Plugin storage shape and default initialisation.
 */
export interface PluginStorage {
	/** Upload endpoint base URL (no trailing slash). */
	serverUrl: string;
	/** Secret bearer token for authentication. */
	apiToken: string;
	/** Files larger than this (in MB) trigger auto-upload. Set to -1 for auto-detect based on Discord limit. */
	maxFileSizeMB: number;
	/** Whether to auto-upload without prompting. */
	autoUpload: boolean;
	/** Whether to automatically send the message after uploading, or just inject into chat box. */
	autoSend: boolean;
}

const DEFAULTS: PluginStorage = {
	serverUrl: "https://xeon.systems/discord",
	apiToken: "",
	maxFileSizeMB: -1,
	autoUpload: true,
	autoSend: true,
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
