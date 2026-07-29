import { before, after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
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
	if (!UploadLimits) {
		console.warn("[VaultRelay] UploadLimits module not found — UI limit patching skipped");
		return undefined;
	}
	
	try {
		const realLimit = UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE;
		if (typeof realLimit === "number") {
			realMaxFileSize = realLimit;
		}

		try {
			UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE = Number.MAX_SAFE_INTEGER;
		} catch {
			Object.defineProperty(UploadLimits, "DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE", {
				value: Number.MAX_SAFE_INTEGER,
				writable: true,
				configurable: true
			});
		}

		return () => {
			try {
				UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE = realLimit;
			} catch {
				Object.defineProperty(UploadLimits, "DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE", {
					value: realLimit,
					writable: true,
					configurable: true
				});
			}
		};
	} catch (err) {
		console.error("[VaultRelay] Failed to patch UploadLimits:", err);
		return undefined;
	}
}

export function patchUploader(): (() => void) | undefined {
	if (!CloudUpload) {
		console.warn("[VaultRelay] CloudUpload module not found — upload patching skipped");
		return undefined;
	}

	const originalUpload = CloudUpload.prototype.reactNativeCompressAndExtractData;
	if (!originalUpload) return undefined;

	let showConfirmationAlert: any;
	try {
		showConfirmationAlert = findByProps("showConfirmationAlert")?.showConfirmationAlert;
	} catch (e) {}

	CloudUpload.prototype.reactNativeCompressAndExtractData = async function (...args: any[]) {
		const file = this;
		let size = file?.preCompressionSize ?? file?.size ?? file?.currentSize;
		if (typeof size !== "number" || size === 0) size = Number.MAX_SAFE_INTEGER;
		
		const cfg = storage as unknown as PluginStorage;
		const channelId = this.channelId ?? ChannelStore?.getChannelId?.();
		const manualSetting = cfg.maxFileSizeMB ?? -1;
		const maxBytes = manualSetting < 0 ? realMaxFileSize : (manualSetting * MB);

		if (size <= maxBytes) return originalUpload.apply(this, args);

		if (!cfg.apiToken) {
			showToast("⚠️ VaultRelay: Missing API Token!", getAssetIDByName("ic_warning_24px"));
			return originalUpload.apply(this, args);
		}

		const doVaultUpload = () => {
			this.preCompressionSize = 1337;
			this.size = 1337;
			(async () => {
				try {
					const url = await uploadToFileHost(file as any, cfg, (pct) => {
						if (pct % 25 === 0) showToast(`📤 Uploading... ${pct}%`, getAssetIDByName("ic_upload"));
					});
					if (typeof this.setStatus === "function") this.setStatus("CANCELED");
					if (channelId) {
						setTimeout(() => {
							try {
								const MessageActions = findByProps("deleteMessage");
								const MessageStore = findByProps("getMessages");
								const msgs = MessageStore?.getMessages(channelId);
								const arr = msgs?._array || msgs?.toArray?.() || Object.values(msgs || {});
								const pending = arr.filter((m: any) => m && m.state === "SEND_FAILED");
								for (const msg of pending) MessageActions?.deleteMessage(channelId, msg.id);
							} catch (err) {}
						}, 1000);
					}
					showToast(`✅ Uploaded to VaultRelay!`, getAssetIDByName("Check"));
					if (channelId) {
						if (cfg.autoSend) {
							sendMessageAggressive(channelId, url);
						} else {
							try {
								const { ComponentDispatch } = findByProps("ComponentDispatch") || {};
								if (ComponentDispatch && ComponentDispatch.dispatchToLastSubscribed) {
									ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: `\n${url} ` });
								}
							} catch (e) {}
						}
					}
				} catch (err: any) {
					showToast(`❌ Upload Failed: ${err.message}`, getAssetIDByName("ic_warning_24px"));
				}
			})();
		};

		if (!cfg.autoUpload && showConfirmationAlert) {
			showConfirmationAlert({
				title: "Upload to VaultRelay?",
				content: `This file is oversized (${(size / MB).toFixed(1)}MB). Do you want to intercept and upload it to your VaultRelay server instead?`,
				confirmText: "Upload",
				cancelText: "Cancel",
				onConfirm: () => doVaultUpload()
			});
			return null; // Return null so original upload is cancelled
		}

		doVaultUpload();
		return null;
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
			const maxBytes = manualSetting < 0 ? realMaxFileSize : (manualSetting * MB);
			const message = args[1];

			if (!cfg.apiToken || !message?.attachments?.length) return;

			const oversized = message.attachments.filter((a: any) => a.size && a.size > maxBytes);
			if (oversized.length === 0) return;

			message.attachments = message.attachments.filter((a: any) => !a.size || a.size <= maxBytes);
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
