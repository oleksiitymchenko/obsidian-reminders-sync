import { CachedMetadata } from "obsidian";
import { ObsidianTask } from "./types";

const TASK_INCOMPLETE = /^(\s*)-\s\[\s\]\s(.+)$/;
const TASK_COMPLETE = /^(\s*)-\s\[x\]\s(.+)$/i;
const DUE_DATE_EMOJI = /📅\s*(\d{4}-\d{2}-\d{2})/;

export function noteIsTaggedForSync(
	cache: CachedMetadata | null,
	syncTag: string
): boolean {
	if (!cache?.frontmatter) return false;
	const tags = cache.frontmatter.tags;
	if (Array.isArray(tags) && tags.includes(syncTag)) return true;
	if (cache.frontmatter[syncTag] === true) return true;
	return false;
}

export function extractTasksFromContent(
	content: string,
	filePath: string
): ObsidianTask[] {
	const lines = content.split("\n");
	const tasks: ObsidianTask[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const incompleteMatch = TASK_INCOMPLETE.exec(line);
		const completeMatch = TASK_COMPLETE.exec(line);
		const match = incompleteMatch ?? completeMatch;
		if (!match) continue;

		const rawText = match[2];
		const dueDateMatch = DUE_DATE_EMOJI.exec(rawText);
		// Use noon UTC to avoid timezone-related date shifts
		const dueDate = dueDateMatch
			? new Date(dueDateMatch[1] + "T12:00:00Z")
			: null;
		const displayText = rawText.replace(DUE_DATE_EMOJI, "").trim();

		tasks.push({
			text: rawText,
			displayText,
			isCompleted: !!completeMatch,
			dueDate,
			lineNumber: i,
			filePath,
		});
	}

	return tasks;
}

export function markTaskCompleteInContent(
	content: string,
	lineNumber: number
): string {
	const lines = content.split("\n");
	if (lineNumber >= 0 && lineNumber < lines.length) {
		lines[lineNumber] = lines[lineNumber].replace(/- \[ \]/, "- [x]");
	}
	return lines.join("\n");
}
