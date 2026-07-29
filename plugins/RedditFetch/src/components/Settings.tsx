import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";

const { FormSection, FormRadioRow, FormSwitchRow, FormIcon, FormInput } = Forms;
const { ScrollView } = ReactNative;

export default function Settings() {
	useProxy(storage);

	return (
		<ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 38 }}>
			<FormSection title="Misc Settings" style={{ marginTop: 12 }}>
				<FormInput
					title="Default Subreddit"
					placeholder="pics"
					value={storage.defaultSubreddit ?? "pics"}
					onChange={(val: string) => {
						storage.defaultSubreddit = val;
					}}
				/>

				<FormInput
					title="API Base URL (Proxy/DNS Bypass)"
					placeholder="https://api.reddit.com"
					value={storage.baseUrl || ""}
					onChange={(val: string) => {
						storage.baseUrl = val.trim();
					}}
				/>

				<FormSwitchRow
					label="NSFW Warning"
					subLabel="Warn when sending an NSFW image in a non-NSFW channel."
					leading={<FormIcon source={getAssetIDByName("ic_warning_24px")} />}
					value={storage.nsfwwarn ?? true}
					onValueChange={(val: boolean) => {
						storage.nsfwwarn = val;
					}}
				/>
			</FormSection>

			<FormSection title="Default Sort" style={{ marginTop: 12 }}>
				{Object.entries({
					Best: "best",
					Hot: "hot",
					New: "new",
					Rising: "rising",
					Top: "top",
					Controversial: "controversial",
				}).map(([label, value]) => (
					<FormRadioRow
						key={value}
						label={label}
						selected={(storage.sortdefs ?? "hot") === value}
						onPress={() => {
							storage.sortdefs = value;
						}}
					/>
				))}
			</FormSection>
		</ScrollView>
	);
}
