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

					const targetPath = `/r/${subreddit}/${sort}?limit=100&raw_json=1`;
					let urlsToTry = [`https://api.reddit.com${targetPath}`];
					
					// If the user specified a custom base URL in settings, try that exclusively (instead of default proxies)
					if (storage.baseUrl && storage.baseUrl.trim() !== "" && storage.baseUrl !== "https://api.reddit.com") {
						urlsToTry = [`${storage.baseUrl.replace(/\/$/, "")}${targetPath}`];
					} else {
						// Default dynamic proxy fallback list for DNS/Censorship bypass
						urlsToTry.push(
							`https://corsproxy.io/?https://api.reddit.com${targetPath}`,
							`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.reddit.com${targetPath}`)}`
						);
					}

					let json = null;
					let fetchError = null;

					for (const url of urlsToTry) {
						try {
							let res = await fetch(url, {
								headers: {
									"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
									"Accept": "application/json",
								},
							});
							if (res.ok) {
								const data = await res.json();
								if (data?.data?.children) {
									json = data;
									break; // Success, exit loop
								}
							}
						} catch (e: any) {
							fetchError = e;
						}
					}

					if (!json) {
						sendBotMessage(ctx.channel.id, `❌ Failed to fetch r/${subreddit}. All endpoints and proxies failed or returned invalid data.\n${fetchError?.message || ""}`);
						return;
					}

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

					const imageRegex = /\.(png|jpg|jpeg|gif|webp)$/i;
					const isImageHost = (url: string) => url.includes("i.redd.it") || (url.includes("imgur.com") && !url.includes("/a/"));

					let imagePosts = json.data?.children?.filter((c: any) => {
						if (!c.data || c.data.is_video) return false;
						const url = c.data.url_overridden_by_dest || c.data.url;
						if (!url) return false;
						return imageRegex.test(url) || isImageHost(url);
					});

					let fallbackWarning = "";
					let finalPost;
					let isImage = true;

					if (!imagePosts || imagePosts.length === 0) {
						// Fallback to text posts
						let textPosts = json.data?.children?.filter((c: any) => {
							if (!c.data || c.data.is_video) return false;
							return c.data.selftext || c.data.url;
						});

						if (!textPosts || textPosts.length === 0) {
							sendBotMessage(ctx.channel.id, `❌ No suitable posts found in r/${subreddit}.`);
							return;
						}
						
						fallbackWarning = "⚠️ *Couldn't find any image posts. Falling back to a text/link post instead!*\n\n";
						finalPost = textPosts[Math.floor(Math.random() * textPosts.length)].data;
						isImage = false;
					} else {
						finalPost = imagePosts[Math.floor(Math.random() * imagePosts.length)].data;
					}

					const postUrl = finalPost.url_overridden_by_dest ?? finalPost.url;
					let imgUrl = postUrl;
					if (isImage) {
						imgUrl = postUrl?.replace(/\.gifv$/g, ".gif");
					}

					const embed: any = {
						type: "rich",
						title: finalPost.title,
						url: `https://reddit.com${finalPost.permalink}`,
						author: {
							name: `u/${finalPost.author} • r/${finalPost.subreddit}`,
						},
						color: 0xdd2e44, 
					};

					if (isImage) {
						embed.image = { url: imgUrl };
					} else {
						// For text posts, set the description
						let desc = finalPost.selftext || finalPost.url;
						if (desc && desc.length > 2000) desc = desc.substring(0, 1997) + "...";
						embed.description = desc;
					}

					if (silent) {
						sendBotMessage(ctx.channel.id, fallbackWarning, [embed]);
					} else {
						if (MessageSender && MessageSender.sendMessage) {
							MessageSender.sendMessage(ctx.channel.id, { 
								content: fallbackWarning + (isImage ? imgUrl : `https://reddit.com${finalPost.permalink}`) 
							});
						} else {
							showToast("MessageSender not found!", getAssetIDByName("ic_warning_24px"));
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
