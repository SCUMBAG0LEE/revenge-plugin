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
				sendLocal(cId, `🧪 Starting automated sandbox tests...`);

				let report = "**🧪 Experiment Sandbox Report**\n\n";

				// Test 1: Message Sender A
				try {
					const Sender = findByProps("sendMessage", "editMessage");
					if (!Sender) throw new Error("Could not find MessageSender module");
					Sender.sendMessage(cId, { content: "Test msg_a! If you see this, msg_a works!", validNonShortcutEmojis: [] });
					report += `✅ \`msg_a\` (MessageSender): Success\n`;
				} catch (e: any) {
					report += `❌ \`msg_a\` Failed: ${e.message}\n`;
				}

				// Test 2: Message Sender B
				try {
					const all = findAll(m => m && m.sendMessage);
					if (all.length === 0) throw new Error("Could not find any module with sendMessage");
					const module = all.find(m => Object.keys(m).length < 20) || all[0];
					module.sendMessage(cId, { content: "Test msg_b! If you see this, msg_b works!", validNonShortcutEmojis: [] });
					report += `✅ \`msg_b\` (Alternate): Success\n`;
				} catch (e: any) {
					report += `❌ \`msg_b\` Failed: ${e.message}\n`;
				}

				// Test 3: Fetch Upload
				try {
					const r = await fetch("https://paste.rs/", { method: "POST", body: "Hello from ExperimentSandbox via fetch!" });
					const text = await r.text();
					if (!r.ok) throw new Error(`HTTP ${r.status} ${text}`);
					report += `✅ \`upload_fetch\`: Success (${text.trim()})\n`;
				} catch (e: any) {
					report += `❌ \`upload_fetch\` Failed: ${e.message}\n`;
				}

				// Test 4: XHR Upload
				await new Promise<void>((resolve) => {
					try {
						const xhr = new XMLHttpRequest();
						xhr.onload = () => {
							if (xhr.status >= 200 && xhr.status < 300) {
								report += `✅ \`upload_xhr\`: Success (${xhr.responseText.trim()})\n`;
							} else {
								report += `❌ \`upload_xhr\` Failed: HTTP ${xhr.status} ${xhr.responseText}\n`;
							}
							resolve();
						};
						xhr.onerror = () => {
							report += `❌ \`upload_xhr\` Failed: Network Error\n`;
							resolve();
						};
						xhr.open("POST", "https://paste.rs/");
						xhr.send("Hello from ExperimentSandbox via XHR!");
					} catch (e: any) {
						report += `❌ \`upload_xhr\` Failed: Exception ${e.message}\n`;
						resolve();
					}
				});

				// Test 5: Theme modules
				try {
					const all = findAll(m => m && Object.keys(m).some(k => k.toLowerCase().includes("theme")));
					const interesting = all.map(m => Object.keys(m).filter(k => k.toLowerCase().includes("theme")));
					const keysDump = JSON.stringify(interesting).substring(0, 500);
					report += `✅ \`find_theme\`: Found ${all.length} modules.\nKeys snippet: \`${keysDump}...\`\n`;
				} catch (e: any) {
					report += `❌ \`find_theme\` Failed: ${e.message}\n`;
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
