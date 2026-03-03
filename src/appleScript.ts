import { exec } from "child_process";
import { promisify } from "util";
import { Notice } from "obsidian";
import { AppleReminder, ObsidianTask } from "./types";

const execAsync = promisify(exec);

function escapeForAppleScript(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function runAppleScript(script: string): Promise<string> {
	try {
		const { stdout, stderr } = await execAsync(
			`osascript <<'APPLESCRIPT'\n${script}\nAPPLESCRIPT`,
			{ timeout: 10_000 }
		);
		if (stderr && stderr.trim()) {
			throw new Error(stderr.trim());
		}
		return stdout.trim();
	} catch (err: any) {
		const msg: string = err?.message ?? "";
		if (
			msg.includes("-1743") ||
			msg.toLowerCase().includes("not authorized")
		) {
			new Notice(
				"Reminders Sync: Permission denied. Please allow Obsidian to " +
					"control Reminders in System Settings → Privacy & Security → Automation.",
				10_000
			);
			return "";
		}
		if (err.killed || msg.includes("ETIMEDOUT")) {
			new Notice(
				"Reminders Sync: Apple Reminders timed out. Is the app responsive?",
				8_000
			);
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
			set output to output & rName & "|||" & rDone & "\n"
		end repeat
	end if
	return output
end tell`);

	if (!output) return [];

	return output
		.split("\n")
		.filter((line) => line.includes("|||"))
		.map((line) => {
			const separatorIdx = line.lastIndexOf("|||");
			const reminderName = line.slice(0, separatorIdx).trim();
			const done = line.slice(separatorIdx + 3).trim();
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
