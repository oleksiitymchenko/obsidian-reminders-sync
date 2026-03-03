import { exec } from "child_process";
import { promisify } from "util";
import { Notice } from "obsidian";
import { AppleReminder, ObsidianTask } from "./types";
import {
	AS_EXEC_TIMEOUT_MS,
	AS_OUTPUT_DELIMITER,
	NOTICE_PERMISSION_DENIED,
	NOTICE_PERMISSION_DURATION_MS,
	NOTICE_TIMEOUT,
	NOTICE_TIMEOUT_DURATION_MS,
} from "./constants";

const execAsync = promisify(exec);

function escapeForAppleScript(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function runAppleScript(script: string): Promise<string> {
	try {
		const { stdout, stderr } = await execAsync(
			`osascript <<'APPLESCRIPT'\n${script}\nAPPLESCRIPT`,
			{ timeout: AS_EXEC_TIMEOUT_MS }
		);
		if (stderr && stderr.trim()) {
			throw new Error(stderr.trim());
		}
		return stdout.trim();
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		const killed = (err as { killed?: boolean }).killed === true;
		if (
			msg.includes("-1743") ||
			msg.toLowerCase().includes("not authorized")
		) {
			new Notice(NOTICE_PERMISSION_DENIED, NOTICE_PERMISSION_DURATION_MS);
			return "";
		}
		if (killed || msg.includes("ETIMEDOUT")) {
			new Notice(NOTICE_TIMEOUT, NOTICE_TIMEOUT_DURATION_MS);
			return "";
		}
		throw err;
	}
}

export async function ensureListExists(listName: string): Promise<void> {
	const name = escapeForAppleScript(listName);
	await runAppleScript(`tell application "Reminders"
	if not (exists list "${name}") then
		make new list with properties {name: "${name}"}
	end if
end tell`);
}

export async function getRemindersInList(
	listName: string
): Promise<AppleReminder[]> {
	const name = escapeForAppleScript(listName);
	const output = await runAppleScript(`tell application "Reminders"
	set output to ""
	if exists list "${name}" then
		repeat with r in reminders of list "${name}"
			set rName to name of r
			set rDone to completed of r as string
			set output to output & rName & "${AS_OUTPUT_DELIMITER}" & rDone & "\n"
		end repeat
	end if
	return output
end tell`);

	if (!output) return [];

	return output
		.split("\n")
		.filter((line) => line.includes(AS_OUTPUT_DELIMITER))
		.map((line) => {
			const separatorIdx = line.lastIndexOf(AS_OUTPUT_DELIMITER);
			const reminderName = line.slice(0, separatorIdx).trim();
			const done = line.slice(separatorIdx + AS_OUTPUT_DELIMITER.length).trim();
			return {
				name: reminderName,
				isCompleted: done === "true",
			};
		});
}

export async function createReminder(
	listName: string,
	task: ObsidianTask
): Promise<void> {
	const name = escapeForAppleScript(listName);
	const taskName = escapeForAppleScript(task.displayText);

	let dueDateLine = "";
	if (task.dueDate) {
		const dateStr = task.dueDate.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
		dueDateLine = `\n\t\tset due date of newReminder to date "${dateStr}"`;
	}

	await runAppleScript(`tell application "Reminders"
	tell list "${name}"
		set newReminder to make new reminder with properties {name: "${taskName}"}${dueDateLine}
	end tell
end tell`);
}

export async function markReminderComplete(
	listName: string,
	reminderName: string
): Promise<void> {
	const name = escapeForAppleScript(listName);
	const taskName = escapeForAppleScript(reminderName);

	await runAppleScript(`tell application "Reminders"
	if exists list "${name}" then
		repeat with r in reminders of list "${name}"
			if name of r = "${taskName}" and completed of r = false then
				set completed of r to true
				exit repeat
			end if
		end repeat
	end if
end tell`);
}
