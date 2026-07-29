import { registerCommand } from "@vendetta/commands";
import { findByProps, findAll } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";

const ChannelStore = findByProps("getLastSelectedChannelId");
const MessageActions = findByProps("receiveMessage", "sendClydeError") ?? findByProps("receiveMessage");
const BotMessageCreator = findByProps("createBotMessage");

function sendLocal(cId: string, content: string) {
	if (!BotMessageCreator || !MessageActions || !cId) return;
	const msg = BotMessageCreator.createBotMessage({ channelId: cId, content });
	MessageActions.receiveMessage(cId, msg);
}

const unpatches: (() => void)[] = [];

export default {
	onLoad() {
		const cmdTest = registerCommand({
			name: "test",
			displayName: "test",
			description: "Run sandbox experiments.",
			displayDescription: "Run sandbox experiments.",
			options: [],
			applicationId: "-1",
			inputType: 1,
			type: 1,
			execute: async (args: any, ctx: any) => {
				const cId = ctx.channel?.id ?? ChannelStore?.getLastSelectedChannelId?.();
				sendLocal(cId, `🧪 Starting advanced sandbox tests...`);

				let report = "**🧪 Advanced Sandbox Report**\n\n";

				// Test 1: Real Message Sender
				try {
					const Sender = findByProps("sendMessage", "editMessage");
					if (!Sender) throw new Error("Could not find MessageSender module");
					
					// Send a REAL message to the channel, not a local bot message
					Sender.sendMessage(cId, { 
						content: "🧪 Hello from Advanced Sandbox! If you see this, real message sending works!", 
						validNonShortcutEmojis: [] 
					});
					report += `✅ \`real_msg\`: Successfully triggered MessageSender (check if real message appeared!)\n`;
				} catch (e: any) {
					report += `❌ \`real_msg\` Failed: ${e.message}\n`;
				}

				// Test 2: VaultRelay HTML 500 Dump
				try {
					const formData = new FormData();
					// In RN, passing a string to FormData acts as a regular form field, which might bypass file limits but still hit the server logic
					formData.append("file", "This is a dummy string payload representing a file");
					
					const r = await fetch("https://xeon.systems/discord/upload", { 
						method: "POST", 
						headers: { "Authorization": "Bearer temporarytestauthtoken" },
						body: formData 
					});
					
					const text = await r.text();
					if (r.status >= 500 || text.includes("<!DOCTYPE html>")) {
						report += `❌ \`vault_upload\` Hit 500 Error!\n**HTML Response Dump:**\n\`\`\`html\n${text.substring(0, 1000)}\n\`\`\`\n`;
					} else {
						report += `✅ \`vault_upload\`: Status ${r.status}, response: ${text.substring(0, 200)}\n`;
					}
				} catch (e: any) {
					report += `❌ \`vault_upload\` Network Error: ${e.message}\n`;
				}

				// Test 3: 5MB Payload to Pastebins
				try {
					// Generate 5MB string
					const massiveString = "A".repeat(5 * 1024 * 1024);
					
					try {
						const r1 = await fetch("https://haste.zneix.eu/documents", { method: "POST", body: massiveString });
						if (r1.ok) {
							report += `✅ \`5MB haste.zneix.eu\`: Success\n`;
						} else {
							report += `❌ \`5MB haste.zneix.eu\`: Failed HTTP ${r1.status} - ${await r1.text()}\n`;
						}
					} catch (e: any) {
						report += `❌ \`5MB haste.zneix.eu\` Crash: ${e.message}\n`;
					}
					
					try {
						const r2 = await fetch("https://paste.nomsy.net/documents", { method: "POST", body: massiveString });
						if (r2.ok) {
							report += `✅ \`5MB paste.nomsy\`: Success\n`;
						} else {
							report += `❌ \`5MB paste.nomsy\`: Failed HTTP ${r2.status} - ${await r2.text()}\n`;
						}
					} catch (e: any) {
						report += `❌ \`5MB paste.nomsy\` Crash: ${e.message}\n`;
					}
				} catch (e: any) {
					report += `❌ \`5MB payload generator\` Failed: ${e.message}\n`;
				}

				// Send final report
				sendLocal(cId, report);
			}
		});
		unpatches.push(cmdTest);
	},
	onUnload() {
		for (const u of unpatches) u();
		unpatches.length = 0;
	}
};
