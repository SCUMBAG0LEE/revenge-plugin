import { before, after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";

import { uploadToFileHost } from "./uploader";
import type { PluginStorage } from "./settings";

// Discord internal modules
const CloudUpload = findByProps("CloudUpload")?.CloudUpload;
const MessageSender = findByProps("sendMessage", "editMessage");
const ChannelStore = findByProps("getChannelId");
const UploadLimits = findByProps("getMaxFileSize");
const PendingMessages = findByProps("getPendingMessages", "deletePendingMessage");

const MB = 1024 * 1024;
export let realMaxFileSize = 10 * MB; // fallback to 10MB

const getMessageActions = () => {
	const g = (globalThis as any);
	if (g?.MessageActions && typeof g.MessageActions === "object") return g.MessageActions;
	const bySendOnly = findByProps("sendMessage");
	if (bySendOnly) return bySendOnly;
	const bySendReceive = findByProps("sendMessage", "receiveMessage");
	if (bySendReceive) return bySendReceive;
	const byCreate = findByProps("createMessage", "getMessages");
	if (byCreate) return byCreate;
	return null;
};

const sendMessageAggressive = async (channelId: string, content: string) => {
	// 1. Try REST API First (Most reliable on RN 0.81.4)
	try {
		const TokenStore = findByProps("getToken");
		const token = TokenStore?.getToken?.();
		if (token) {
			const restRes = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
				method: "POST",
				headers: { "Authorization": token, "Content-Type": "application/json" },
				body: JSON.stringify({ content, nonce: Math.floor(Math.random() * 1000000000000000).toString() })
			});
			if (restRes.ok) return { ok: true };
		}
	} catch (e) {}

	// 2. Fallback to Internal Modules
	const MA = getMessageActions();
	if (!MA) return { ok: false };
	const msgObj = { content };
	const nonce = Date.now().toString();
	const attempts = [
		() => MA?.sendMessage?.(channelId, msgObj),
		() => MA?.sendMessage?.(channelId, msgObj, true),
		() => MA?.sendMessage?.(channelId, msgObj, undefined, { nonce }),
		() => MA?.createMessage?.(channelId, msgObj),
		() => MA?.createMessage?.(channelId, content),
		() => MA?.createMessage?.(channelId, msgObj, undefined, { nonce }),
		() => MA?.sendMessage?.(channelId, content),
		() => MA?.sendMessage?.(channelId, content, true),
		() => MA.default?.createMessage?.(channelId, msgObj),
		() => MA?.dispatch?.({ type: "CREATE_MESSAGE", channelId, message: msgObj })
	];
	for (const fn of attempts) {
		try {
			const res = fn();
			if (res && typeof (res as any).then === "function") await res;
			return { ok: true };
		} catch (e) {}
	}
	
	return { ok: false };
};

export function patchUploadLimits(): (() => void) | undefined {
	const UploadLimits = findByProps("DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE");
	const FileUtils = findByProps("maxFileSize", "makeFile");
	const PremiumUtils = findByProps("getUserMaxFileSize");
	
	const unpatches: (() => void)[] = [];

	if (UploadLimits) {
		try {
			const realLimit = UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE;
			if (typeof realLimit === "number") realMaxFileSize = realLimit;
			try { UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE = Number.MAX_SAFE_INTEGER; } 
			catch { Object.defineProperty(UploadLimits, "DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE", { value: Number.MAX_SAFE_INTEGER, writable: true, configurable: true }); }

			unpatches.push(() => {
				try { UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE = realLimit; } 
				catch { Object.defineProperty(UploadLimits, "DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE", { value: realLimit, writable: true, configurable: true }); }
			});
		} catch (err) { }
	}



	if (FileUtils) {
		try {
			if (typeof FileUtils.makeFile === "function") {
				unpatches.push(after("makeFile", FileUtils, (_, ret) => {
					if (ret && typeof ret.size === "number") {
						ret._realSize = ret.size;
						ret.size = 1000;
					}
					return ret;
				}));
			}

			for (const key of Object.keys(FileUtils)) {
				if (typeof FileUtils[key] === "function") {
					if (key.toLowerCase().includes("large")) unpatches.push(after(key, FileUtils, () => false));
					if (key.toLowerCase().includes("max")) unpatches.push(after(key, FileUtils, () => Number.MAX_SAFE_INTEGER));
				} else if (typeof FileUtils[key] === "number") {
					if (key.toLowerCase().includes("max") || key.toLowerCase().includes("limit") || key.toLowerCase().includes("size")) {
						const real = FileUtils[key];
						try { FileUtils[key] = Number.MAX_SAFE_INTEGER; }
						catch { Object.defineProperty(FileUtils, key, { value: Number.MAX_SAFE_INTEGER, writable: true, configurable: true }); }
						unpatches.push(() => {
							try { FileUtils[key] = real; }
							catch { Object.defineProperty(FileUtils, key, { value: real, writable: true, configurable: true }); }
						});
					}
				}
			}
		} catch (e) {}
	}
	
	return () => unpatches.forEach(u => u());
}

function cleanup(channelId: string) {
	let attempts = 0;
	const interval = setInterval(() => {
		attempts++;
		if (attempts > 10) {
			clearInterval(interval);
			return; // Give up after 5 seconds
		}
		try {
			const pending = PendingMessages?.getPendingMessages?.(channelId);
			if (!pending) return;

			let deletedAny = false;
			const MessageActions = findByProps("deleteMessage");
			
			for (const [messageId, message] of Object.entries(pending)) {
				if ((message as any).state === "FAILED" || (message as any).state === "SEND_FAILED") {
					// Nuke it from the pending queue to bypass mods
					try { PendingMessages?.deletePendingMessage?.(channelId, messageId); } catch (e) {}
					// Nuke it from the actual message store just in case
					try { MessageActions?.deleteMessage?.(channelId, messageId); } catch (e) {}
					console.log(`[VaultRelay] Deleted failed message: ${messageId}`);
					deletedAny = true;
				}
			}
			
			if (deletedAny) {
				clearInterval(interval);
			}
		} catch (err) {
			console.warn("[VaultRelay] Failed to delete pending messages:", err);
			clearInterval(interval);
		}
	}, 500);
}


import { showConfirmationAlert } from "@vendetta/ui/alerts";

export function patchUploader(): (() => void) | undefined {
	if (!CloudUpload) {
		console.warn("[VaultRelay] CloudUpload module not found — upload patching skipped");
		return undefined;
	}

	const originalUpload = CloudUpload.prototype.reactNativeCompressAndExtractData;
	if (!originalUpload) return undefined;

	CloudUpload.prototype.reactNativeCompressAndExtractData = async function (...args: any[]) {
		const file = this;
		let size = file?._realSize ?? file?.preCompressionSize ?? file?.size ?? file?.currentSize;
		if (typeof size !== "number" || size === 0) size = Number.MAX_SAFE_INTEGER;
		
		const cfg = storage as unknown as PluginStorage;
		const channelId = this.channelId ?? ChannelStore?.getChannelId?.();
		
		let dynamicRealLimit = 25 * MB; // Safe default fallback (Discord's new free tier limit)
		try {
			const UserStore = findByProps("getCurrentUser");
			const PremiumUtils = findByProps("getUserMaxFileSize");
			if (UserStore && PremiumUtils) {
				const user = UserStore.getCurrentUser();
				if (user) {
					const limit = PremiumUtils.getUserMaxFileSize(user);
					// Accept the limit only if it's a valid number and not the absurd 200MB pre-compression constant
					if (typeof limit === "number" && limit > 0 && limit < (200 * MB)) {
						dynamicRealLimit = limit;
					} else if (limit >= (200 * MB)) {
						// If Discord returns 200MB+ (usually Nitro limit is 500MB, but let's assume if it's returning the pre-compression limit it's bugged)
						// Wait, Nitro max is 500MB! So we SHOULD allow limits up to 500MB!
						if (limit === 524288000) { // exactly 500MB
							dynamicRealLimit = limit;
						}
					}
				}
			}
		} catch (e) {}

		const manualSetting = cfg.maxFileSizeMB ?? -1;
		const userLimitBytes = manualSetting < 0 ? dynamicRealLimit : (manualSetting * MB);

		const exceedsUserLimit = size > userLimitBytes;
		const exceedsDiscordLimit = size > dynamicRealLimit;

		// If it doesn't exceed the user's limit and it doesn't exceed Discord's hard limit, let Discord handle it.
		if (!exceedsUserLimit && !exceedsDiscordLimit) {
			return originalUpload.apply(this, args);
		}

		if (!cfg.apiToken) {
			showToast("⚠️ VaultRelay: Missing API Token!", getAssetIDByName("ic_warning_24px"));
			return originalUpload.apply(this, args);
		}

		const doVaultUpload = () => {
			this.preCompressionSize = 1337;
			this.size = 1337;
			(async () => {
				try {
					showToast(`📤 Starting upload process...`);
					const uploadInterval = setInterval(() => {
						showToast(`📤 Uploading...`);
					}, 4000);
					
					let url: string;
					try {
						url = await uploadToFileHost(file as any, cfg);
					} finally {
						clearInterval(uploadInterval);
					}

					if (typeof this.setStatus === "function") this.setStatus("CANCELED");
					if (typeof this.cancel === "function") this.cancel();
					if (channelId) cleanup(channelId);
					showToast(`✅ Uploading finished!`);
					
					if (channelId) {
						if (cfg.autoSend) {
							sendMessageAggressive(channelId, url);
						} else {
							let copied = false;
							try {
								if (clipboard && clipboard.setString) {
									clipboard.setString(url);
									showToast("📋 Link copied to clipboard!");
									copied = true;
								}
							} catch (e) {
								console.error("[VaultRelay] Clipboard error:", e);
							}
							
							if (!copied) {
								try {
									const { ReactNative } = require("@vendetta/metro/common");
									if (ReactNative && ReactNative.Share && ReactNative.Share.share) {
										ReactNative.Share.share({ message: url });
									} else {
										const Share = findByProps("share", "sharedAction");
										if (Share && Share.share) Share.share({ message: url });
									}
								} catch (e) {
									console.error("[VaultRelay] Share fallback error:", e);
								}
							}
						}
					}
				} catch (err: any) {
					showToast(`❌ Upload Failed: ${err.message}`, getAssetIDByName("ic_warning_24px"));
					if (channelId) cleanup(channelId);
				}
			})();
		};

		if (!cfg.autoUpload) {
			const reason = exceedsDiscordLimit && !exceedsUserLimit
				? `This file (${(size / MB).toFixed(1)}MB) exceeds Discord's hard limit of ${(dynamicRealLimit / MB).toFixed(1)}MB.`
				: `This file (${(size / MB).toFixed(1)}MB) exceeds your VaultRelay size limit.`;
				
			return new Promise((resolve) => {
				const handleCancel = () => resolve(originalUpload.apply(this, args));
				const handleConfirm = () => {
					doVaultUpload();
					if (typeof this.setStatus === "function") this.setStatus("CANCELED");
					if (typeof this.cancel === "function") this.cancel();
					if (channelId) cleanup(channelId);
					resolve(null);
				};

				try {
					const { ReactNative } = require("@vendetta/metro/common");
					const Alert = findByProps("alert") ?? ReactNative?.Alert;
					
					if (Alert && Alert.alert) {
						Alert.alert(
							"Upload to VaultRelay?",
							`${reason} Do you want to intercept and upload it to your VaultRelay server instead?`,
							[
								{ text: "Cancel", style: "cancel", onPress: handleCancel },
								{ text: "Upload", onPress: handleConfirm }
							],
							{ cancelable: false }
						);
						return;
					}
				} catch (e) {
					console.error("[VaultRelay] Failed to invoke native Alert", e);
				}
				
				// Fallback to Vendetta's custom dialog if native Alert is missing or crashes
				try {
					showConfirmationAlert({
						title: "Upload to VaultRelay?",
						content: `${reason} Do you want to intercept and upload it to your VaultRelay server instead?\n\n(WARNING: Do not tap outside this box or it will freeze!)`,
						confirmText: "Upload",
						cancelText: "Cancel",
						onConfirm: handleConfirm,
						onCancel: handleCancel
					});
				} catch (e) {
					showToast("❌ VaultRelay: Failed to show confirmation dialog.");
					handleCancel();
				}
			});
		}

		doVaultUpload();
		if (typeof this.setStatus === "function") this.setStatus("CANCELED");
		if (typeof this.cancel === "function") this.cancel();
		return null; // Return null so Discord gracefully aborts the native upload
	};

	return () => {
		CloudUpload.prototype.reactNativeCompressAndExtractData = originalUpload;
	};
}

export function patchMessageSender(): (() => void) | undefined {
	if (!MessageSender) return undefined;

	try {
		return before("sendMessage", MessageSender, (args: any[]) => {
			const cfg = storage as unknown as PluginStorage;
			const manualSetting = cfg.maxFileSizeMB ?? -1;
			const userLimitBytes = manualSetting < 0 ? realMaxFileSize : (manualSetting * MB);
			const message = args[1];

			if (!cfg.apiToken || !message?.attachments?.length) return;

			const oversized = message.attachments.filter((a: any) => a.size && (a.size > userLimitBytes || a.size > realMaxFileSize));
			if (oversized.length === 0) return;

			message.attachments = message.attachments.filter((a: any) => !a.size || (a.size <= userLimitBytes && a.size <= realMaxFileSize));
			const channelId = args[0];

			for (const file of oversized) {
				showToast(`📤 Uploading ${file.filename ?? "file"} to VaultRelay...`, getAssetIDByName("ic_upload"));
				uploadToFileHost({ uri: file.uri ?? file.url, name: file.filename ?? "file", type: file.content_type ?? "application/octet-stream" }, cfg)
					.then((url) => {
						showToast(`✅ Uploaded to VaultRelay!`, getAssetIDByName("Check"));
						if (cfg.autoSend) sendMessageAggressive(channelId, url);
						else {
							try {
								const { ComponentDispatch } = findByProps("ComponentDispatch") || {};
								if (ComponentDispatch && ComponentDispatch.dispatchToLastSubscribed) ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: `\n${url} ` });
							} catch (e) {}
						}
					})
					.catch((err: Error) => {
						showToast(`❌ Upload failed: ${err.message}`, getAssetIDByName("Small"));
					});
			}
		});
	} catch (err) {
		console.error("[VaultRelay] Failed to patch MessageSender:", err);
		return undefined;
	}
}
