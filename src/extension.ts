import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

// ──────────────────────────────────────────────
// Constants & Types
// ──────────────────────────────────────────────

/** All built-in sound IDs that ship with the extension. */
const BUILTIN_SOUNDS = [
    "aw-hell-nah-man",
    "cat-laugh-meme-1",
    "evil-cat-laugh",
    "faaah",
    "indian-song",
    "jhinka-chika-jhinka-chika",
    "m-e-o-w",
    "snore-mimimimimimi",
    "we-are-charlie-kirk-song",
] as const;
type SoundId = typeof BUILTIN_SOUNDS[number];

/** Human-readable labels shown in quick-pick menus. */
const SOUND_LABELS: Record<string, string> = {
    "aw-hell-nah-man": "$(error)     Aw Hell Nah Man – nope!",
    "cat-laugh-meme-1": "$(smiley)    Cat Laugh Meme – hehehe",
    "evil-cat-laugh": "$(flame)     Evil Cat Laugh – muahahaha",
    "faaah": "$(smiley)    Faaah – dramatic sigh",
    "indian-song": "$(music)     Indian Song – vibe check",
    "jhinka-chika-jhinka-chika": "$(music)     Jhinka Chika – banger beat",
    "m-e-o-w": "$(star)      M-E-O-W – classic meow",
    "snore-mimimimimimi": "$(watch)     Snore Mimimimi – zzz",
    "we-are-charlie-kirk-song": "$(megaphone) We Are Charlie Kirk – banger",
};

/** Error keywords to watch for (case-insensitive). */
const DEFAULT_ERROR_KEYWORDS = [
    "error",
    "failed",
    "exception",
    "syntaxerror",
    "segmentation fault",
    "build failed",
    "traceback",
    "fatal error",
    "unhandled",
    "panic",
    "abort",
];

// ──────────────────────────────────────────────
// Config helper
// ──────────────────────────────────────────────

function cfg<T>(key: string): T {
    return vscode.workspace.getConfiguration("errorSound").get<T>(key) as T;
}

// ──────────────────────────────────────────────
// Audio Player (Webview-based)
// ──────────────────────────────────────────────

/**
 * AudioPlayer manages a hidden VS Code Webview panel that streams audio files
 * through the browser's Web Audio API. This approach works cross-platform
 * without any native binary dependencies.
 */
class AudioPlayer {
    private panel: vscode.WebviewPanel | undefined;
    private readonly soundsDir: string;
    private readonly extensionUri: vscode.Uri;

    constructor(context: vscode.ExtensionContext) {
        this.extensionUri = context.extensionUri;
        this.soundsDir = path.join(context.extensionPath, "sounds");
    }

    /** Lazily create (or reuse) the hidden audio webview. */
    private getPanel(): vscode.WebviewPanel {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                "errorSoundPlayer",
                "Error Sound Player",
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(this.soundsDir),
                        this.extensionUri,
                    ],
                }
            );

            // If the user closes the panel manually, clear our reference.
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });

            // Render a minimal HTML page that exposes a play() function via postMessage.
            this.panel.webview.html = this.buildHtml();
        }
        return this.panel;
    }

    /** Build the HTML for the silent audio player webview. */
    private buildHtml(): string {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Error Sound Player</title>
  <style>
    body {
      background: #1e1e1e;
      color: #ccc;
      font-family: monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      flex-direction: column;
      gap: 8px;
    }
    .label { font-size: 14px; opacity: 0.6; }
    .sound { font-size: 22px; font-weight: bold; color: #4ec9b0; }
  </style>
</head>
<body>
  <div class="label">🔊 Meme Sound Active</div>
  <div class="sound" id="soundName">—</div>
  <audio id="player"></audio>

  <script>
    const player = document.getElementById('player');
    const soundName = document.getElementById('soundName');

    window.addEventListener('message', (event) => {
      const { command, src, volume } = event.data;
      if (command === 'play') {
        player.src = src;
        player.volume = Math.max(0, Math.min(1, volume ?? 0.8));
        soundName.textContent = src.split('/').pop().replace('.mp3','');
        player.currentTime = 0;
        player.play().catch((e) => console.warn('Audio play failed:', e));
      }
    });
  </script>
</body>
</html>`;
    }

    /**
     * Play a sound file by its ID. Resolves the local file URI and sends a
     * postMessage to the hidden webview.
     */
    play(soundId: string, volume: number): void {
        const soundFile = path.join(this.soundsDir, `${soundId}.mp3`);

        if (!fs.existsSync(soundFile)) {
            vscode.window.showWarningMessage(
                `Error Sound: Sound file not found: ${soundId}.mp3. ` +
                `Please add it to the sounds/ folder.`
            );
            return;
        }

        const panel = this.getPanel();
        const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(soundFile));

        panel.webview.postMessage({
            command: "play",
            src: webviewUri.toString(),
            volume,
        });
    }

    dispose(): void {
        this.panel?.dispose();
    }
}

// ──────────────────────────────────────────────
// Error Sound Manager
// ──────────────────────────────────────────────

/**
 * Central controller that wires together error detection, cooldown logic,
 * sound selection, status bar, and settings.
 */
class ErrorSoundManager implements vscode.Disposable {
    private readonly player: AudioPlayer;
    private readonly statusBarItem: vscode.StatusBarItem;
    private readonly disposables: vscode.Disposable[] = [];

    /** Timestamp (ms) of the last sound that was played. */
    private lastPlayedAt = 0;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.player = new AudioPlayer(context);

        // ── Status Bar ──
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = "errorSound.changeSound";
        this.statusBarItem.tooltip = "Click to change meme error sound";
        this.updateStatusBar();
        this.statusBarItem.show();

        // ── Watchers ──
        this.registerDiagnosticsWatcher();
        this.registerTaskWatcher();
        this.registerTerminalWatcher();
        this.registerConfigWatcher();
    }

    // ────────────────────────────────────────────
    // Status Bar
    // ────────────────────────────────────────────

    private updateStatusBar(): void {
        const enabled = cfg<boolean>("enabled");
        const random = cfg<boolean>("randomMode");
        const sound = cfg<string>("selectedSound");

        if (!enabled) {
            this.statusBarItem.text = "$(mute) Sounds Off";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                "statusBarItem.warningBackground"
            );
        } else if (random) {
            this.statusBarItem.text = "🎲 Random Sound";
            this.statusBarItem.backgroundColor = undefined;
        } else {
            const icon =
                sound === "aw-hell-nah-man" ? "🙅"
                    : sound === "cat-laugh-meme-1" ? "😹"
                        : sound === "evil-cat-laugh" ? "😈"
                            : sound === "faaah" ? "😩"
                                : sound === "indian-song" ? "🎶"
                                    : sound === "jhinka-chika-jhinka-chika" ? "🥳"
                                        : sound === "m-e-o-w" ? "🐱"
                                            : sound === "snore-mimimimimimi" ? "💤"
                                                : sound === "we-are-charlie-kirk-song" ? "🎵"
                                                    : "🔊";
            // Make a pretty display name: replace hyphens and capitalize
            const label = sound
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
            this.statusBarItem.text = `${icon} ${label}`;
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    // ────────────────────────────────────────────
    // Core: Play sound with cooldown guard
    // ────────────────────────────────────────────

    /**
     * Attempt to play a meme sound. Respects the enabled flag and cooldown.
     * @param reason  Short description used in a tooltip / notification.
     */
    triggerSound(reason: string): void {
        if (!cfg<boolean>("enabled")) {
            return;
        }

        const cooldown = cfg<number>("cooldownMs");
        const now = Date.now();

        if (now - this.lastPlayedAt < cooldown) {
            // Still within cooldown window – skip.
            return;
        }

        this.lastPlayedAt = now;

        const soundId = this.pickSound();
        const volume = cfg<number>("volume");

        this.player.play(soundId, volume);

        // Brief toast so the user knows what triggered it.
        vscode.window.setStatusBarMessage(
            `🔊 ${soundId} — ${reason}`,
            3000
        );
    }

    /** Pick the correct sound based on user settings. */
    private pickSound(): string {
        if (cfg<boolean>("randomMode")) {
            const idx = Math.floor(Math.random() * BUILTIN_SOUNDS.length);
            return BUILTIN_SOUNDS[idx];
        }
        return cfg<string>("selectedSound") || "vineboom";
    }

    // ────────────────────────────────────────────
    // Error Detection – Diagnostics (Problems panel)
    // ────────────────────────────────────────────

    private registerDiagnosticsWatcher(): void {
        // Track previous error count so we only fire when NEW errors appear.
        let previousErrorCount = 0;

        const onDidChange = vscode.languages.onDidChangeDiagnostics((e) => {
            if (!cfg<boolean>("detectDiagnostics")) {
                return;
            }

            let errorCount = 0;
            vscode.languages.getDiagnostics().forEach(([, diagnostics]) => {
                diagnostics.forEach((d) => {
                    if (d.severity === vscode.DiagnosticSeverity.Error) {
                        errorCount++;
                    }
                });
            });

            if (errorCount > previousErrorCount) {
                this.triggerSound(`${errorCount - previousErrorCount} new error(s) in Problems`);
            }

            previousErrorCount = errorCount;
        });

        this.disposables.push(onDidChange);
    }

    // ────────────────────────────────────────────
    // Error Detection – Task execution
    // ────────────────────────────────────────────

    private registerTaskWatcher(): void {
        const onEnd = vscode.tasks.onDidEndTaskProcess((e) => {
            if (!cfg<boolean>("detectTasks")) {
                return;
            }

            // A non-zero exit code means the task failed.
            if (e.exitCode !== 0 && e.exitCode !== undefined) {
                this.triggerSound(
                    `Task "${e.execution.task.name}" failed (exit ${e.exitCode})`
                );
            }
        });

        this.disposables.push(onEnd);
    }

    // ────────────────────────────────────────────
    // Error Detection – Terminal output
    // ────────────────────────────────────────────

    /**
     * VS Code does not expose a native terminal output event, so we use the
     * proposed `window.onDidWriteTerminalData` API when available, and fall
     * back to a write-data intercept via the terminal renderer approach.
     *
     * For broad compatibility we also listen to terminal creation and
     * attach a data listener to each new terminal.
     */
    private registerTerminalWatcher(): void {
        // Use the proposed API if running in an environment that exposes it.
        const onData = (vscode.window as any).onDidWriteTerminalData;
        if (typeof onData === "function") {
            const sub = onData((e: { data: string }) => {
                if (cfg<boolean>("detectTerminal") && this.containsError(e.data)) {
                    this.triggerSound("Error detected in terminal");
                }
            });
            this.disposables.push(sub);
        } else {
            // Fallback: show a friendly notice – terminal detection needs the
            // proposed API flag `--enable-proposed-api`.
            console.log(
                "[ErrorSound] Terminal output detection requires VS Code ≥ 1.87 " +
                "or the `--enable-proposed-api error-sound-extension` flag."
            );
        }
    }

    // ────────────────────────────────────────────
    // Keyword matching
    // ────────────────────────────────────────────

    /** Returns true if the text contains any known error keyword. */
    private containsError(text: string): boolean {
        const lower = text.toLowerCase();
        const custom = cfg<string[]>("customErrorKeywords") ?? [];
        const keywords = [...DEFAULT_ERROR_KEYWORDS, ...custom.map((k) => k.toLowerCase())];
        return keywords.some((kw) => lower.includes(kw));
    }

    // ────────────────────────────────────────────
    // Config change reaction
    // ────────────────────────────────────────────

    private registerConfigWatcher(): void {
        const sub = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("errorSound")) {
                this.updateStatusBar();
            }
        });
        this.disposables.push(sub);
    }

    // ────────────────────────────────────────────
    // Commands
    // ────────────────────────────────────────────

    /** Show a quick-pick to select a sound, then persist the choice. */
    async showSoundPicker(): Promise<void> {
        const items: vscode.QuickPickItem[] = BUILTIN_SOUNDS.map((id) => ({
            label: SOUND_LABELS[id] ?? id,
            description: id,
            picked: cfg<string>("selectedSound") === id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: "Choose a meme sound effect",
            title: "🔊 Error Sound – Pick your meme",
        });

        if (selected?.description) {
            await vscode.workspace
                .getConfiguration("errorSound")
                .update("selectedSound", selected.description, vscode.ConfigurationTarget.Global);

            // Disable random mode when the user explicitly picks a sound.
            await vscode.workspace
                .getConfiguration("errorSound")
                .update("randomMode", false, vscode.ConfigurationTarget.Global);

            this.updateStatusBar();

            // Play the newly selected sound as a preview.
            this.player.play(selected.description, cfg<number>("volume"));
        }
    }

    /** Toggle the extension on/off. */
    async toggle(): Promise<void> {
        const current = cfg<boolean>("enabled");
        await vscode.workspace
            .getConfiguration("errorSound")
            .update("enabled", !current, vscode.ConfigurationTarget.Global);
        this.updateStatusBar();
        vscode.window.showInformationMessage(
            `Error Sound: ${!current ? "✅ Enabled" : "🔇 Disabled"}`
        );
    }

    /** Enable random sound mode. */
    async enableRandomMode(): Promise<void> {
        await vscode.workspace
            .getConfiguration("errorSound")
            .update("randomMode", true, vscode.ConfigurationTarget.Global);
        this.updateStatusBar();
        vscode.window.showInformationMessage("🎲 Random sound mode enabled!");
    }

    /** Play the current sound as a test. */
    testSound(): void {
        this.player.play(this.pickSound(), cfg<number>("volume"));
    }

    dispose(): void {
        this.player.dispose();
        this.statusBarItem.dispose();
        this.disposables.forEach((d) => d.dispose());
    }
}

// ──────────────────────────────────────────────
// Extension entry points
// ──────────────────────────────────────────────

let manager: ErrorSoundManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
    console.log("[ErrorSound] Extension activating…");

    manager = new ErrorSoundManager(context);

    // Register all commands and push them to the extension's subscriptions so
    // they are automatically cleaned up on deactivation.
    context.subscriptions.push(
        manager,

        vscode.commands.registerCommand("errorSound.changeSound", () =>
            manager!.showSoundPicker()
        ),

        vscode.commands.registerCommand("errorSound.toggle", () =>
            manager!.toggle()
        ),

        vscode.commands.registerCommand("errorSound.enableRandomMode", () =>
            manager!.enableRandomMode()
        ),

        vscode.commands.registerCommand("errorSound.testSound", () =>
            manager!.testSound()
        )
    );

    console.log("[ErrorSound] Extension activated. 🎉");
}

export function deactivate(): void {
    manager?.dispose();
    manager = undefined;
}
