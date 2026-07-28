import { storage } from "@vendetta/plugin";

import { ensureDefaults } from "./settings";
import { patchUploader, patchMessageSender, patchUploadLimits } from "./handler";
import Settings from "./components/Settings";

const unpatches: (() => void)[] = [];

export default {
	onLoad() {
		ensureDefaults(storage);

		const u0 = patchUploadLimits();
		if (u0) unpatches.push(u0);

		const u1 = patchUploader();
		if (u1) unpatches.push(u1);

		const u2 = patchMessageSender();
		if (u2) unpatches.push(u2);
	},

	onUnload() {
		for (const unpatch of unpatches) {
			try {
				unpatch();
			} catch (e) {
				console.error("[VaultRelay] Error during unpatch:", e);
			}
		}
		unpatches.length = 0;
	},

	settings: Settings,
};
