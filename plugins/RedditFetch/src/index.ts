import { storage } from "@vendetta/plugin";
import { registerCommand } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";
import { logger } from "@vendetta";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./components/Settings";

const MessageSender = findByProps("sendMessage", "editMessage");
const MessageActions = findByProps("receiveMessage", "sendClydeError") ?? findByProps("receiveMessage");
const ChannelStore = findByProps("getLastSelectedChannelId");
const BotMessageCreator = findByProps("createBotMessage");
const BotAvatars = findByProps("BOT_AVATARS");

// Helper to send local/bot messages
function sendBotMessage(channelId: string, content: string, embeds: any[] = []) {
	const cId = channelId ?? ChannelStore?.getChannelId?.() ?? ChannelStore?.getLastSelectedChannelId?.();
	if (!BotMessageCreator || !MessageActions) return;

	const msg = BotMessageCreator.createBotMessage({ channelId: cId, content: "", embeds });

	// Megumin persona!
	msg.author.username = "Megumin";
	msg.author.avatar = "Megumin";
	if (BotAvatars && BotAvatars.BOT_AVATARS) {
		BotAvatars.BOT_AVATARS.Megumin = "https://upload.wikimedia.org/wikipedia/en/b/b3/Megumin_light_novel.png";
	}

	if (typeof content === "string") {
		msg.content = content;
	} else {
		Object.assign(msg, content);
	}

	MessageActions.receiveMessage(cId, msg);
}

const unpatches: (() => void)[] = [];

export default {
	onLoad() {
		// Set defaults
		storage.nsfwwarn ??= true;
		storage.sortdefs ??= "hot";
		storage.defaultSubreddit ??= "Megumin";

		const cmd = registerCommand({
			name: "reddit",
			displayName: "reddit",
			description: "Fetch a random image from a subreddit",
			displayDescription: "Fetch a random image from a subreddit",
			options: [
				{
					name: "subreddit",
					displayName: "subreddit",
					description: "The subreddit to fetch from (defaults to settings)",
					displayDescription: "The subreddit to fetch from",
					required: false,
					type: 3, // STRING
				},
				{
					name: "sort",
					displayName: "sort",
					description: "Sort by best, hot, new, rising, top, controversial",
					displayDescription: "Sort by best, hot, new, rising, top, controversial",
					required: false,
					type: 3,
					choices: [
						{ name: "best", displayName: "best", value: "best" },
						{ name: "hot", displayName: "hot", value: "hot" },
						{ name: "new", displayName: "new", value: "new" },
						{ name: "rising", displayName: "rising", value: "rising" },
						{ name: "top", displayName: "top", value: "top" },
						{ name: "controversial", displayName: "controversial", value: "controversial" },
					]
				},
				{
					name: "silent",
					displayName: "silent",
					description: "Makes it so only you can see the message",
					displayDescription: "Makes it so only you can see the message",
					required: false,
					type: 5, // BOOLEAN
				},
			],
			applicationId: "-1",
			inputType: 1,
			type: 1,
			execute: async (args: any, ctx: any) => {
				try {
					let subreddit = args.find((a: any) => a.name === "subreddit")?.value;
					let sort = args.find((a: any) => a.name === "sort")?.value;
					let silent = args.find((a: any) => a.name === "silent")?.value;

					if (!subreddit) subreddit = storage.defaultSubreddit || "Megumin";
					if (!sort) sort = storage.sortdefs || "hot";
					if (silent === undefined) silent = true;

					if (!["best", "hot", "new", "rising", "top", "controversial"].includes(sort)) {
						sendBotMessage(
							ctx.channel.id,
							"❌ Incorrect sorting type. Valid options are:\n`best`, `hot`, `new`, `rising`, `top`, `controversial`."
						);
						return;
					}

					try {
						const lim = findByProps("getMaxFileSize");
						const msg = findByProps("sendMessage", "editMessage");
						showToast(`Debug: msg=${!!msg}, lim=${!!lim}`, getAssetIDByName("ic_info"));
					} catch (e) { }

					let res = await fetch(`https://api.reddit.com/r/${subreddit}/${sort}?limit=100&raw_json=1`, {
						headers: {
							"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
							"Accept": "application/json",
						},
					});
					if (!res.ok) {
						sendBotMessage(ctx.channel.id, `❌ Failed to fetch r/${subreddit} (HTTP ${res.status})`);
						return;
					}
					let json = await res.json();

					// Check NSFW if channel is not NSFW and nsfwwarn is on and it's NOT a silent message
					if (!ctx.channel.nsfw_ && storage.nsfwwarn && !silent) {
						// Simple check if the sub or post is NSFW
						const hasNSFW = json.data?.children?.some((c: any) => c.data?.over_18);
						if (hasNSFW) {
							sendBotMessage(
								ctx.channel.id,
								`⚠️ **Warning**: r/${subreddit} contains NSFW content and this is a SFW channel!\n*(You can disable this check in plugin settings or use silent: true)*`
							);
							return;
						}
					}

					const posts = json.data?.children?.filter((c: any) => c.data && !c.data.is_video && c.data.url);
					if (!posts || posts.length === 0) {
						sendBotMessage(ctx.channel.id, `❌ No suitable images found in r/${subreddit}.`);
						return;
					}

					const post = posts[Math.floor(Math.random() * posts.length)].data;
					const imgUrl = post.url_overridden_by_dest?.replace(/\.gifv$/g, ".gif") ?? post.url?.replace(/\.gifv$/g, ".gif");

					const embed = {
						type: "rich",
						title: post.title,
						url: `https://reddit.com${post.permalink}`,
						author: {
							name: `u/${post.author} • r/${post.subreddit}`,
						},
						image: {
							url: imgUrl,
						},
						color: 0xdd2e44, // Megumin crimson red!
					};

					if (silent) {
						sendBotMessage(ctx.channel.id, "", [embed]);
					} else {
						const cId = ctx.channel?.id ?? ChannelStore?.getChannelId?.() ?? ChannelStore?.getLastSelectedChannelId?.();
						if (MessageSender && cId) {
							MessageSender.sendMessage(cId, { content: imgUrl });
						}
					}
				} catch (err: any) {
					logger.log(err);
					sendBotMessage(ctx.channel.id, `❌ Explosion!! Check debug logs!\n${err.message}`);
				}
			},
		});

		unpatches.push(cmd);
	},

	onUnload() {
		for (const unpatch of unpatches) unpatch();
		unpatches.length = 0;
	},

	settings: Settings,
};
