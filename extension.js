const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");

function generateTree(dir, prefix = "") {
    let result = "";
    const items = fs.readdirSync(dir);

    items.forEach((item, index) => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        const isDir = stat.isDirectory();
        const isLast = index === items.length - 1;

        const pointer = isLast ? "└─" : "├─";
        const icon = isDir ? "📁" : "📄";

        // ✅ Klasör ismi veya dosya ismi yazılır
        result += `${prefix}${pointer} ${icon} ${item}\n`;

        // ✅ Klasörse içeriği recursive çiz
        if (isDir) {
            const newPrefix = prefix + (isLast ? "   " : "│  ");
            result += generateTree(fullPath, newPrefix);
        }
    });

    return result;
}

function drawMapAsPNG(txtFilePath, outputPath) {
    registerFont("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", {
        family: "DejaVu Sans Mono",
    });

    const content = fs.readFileSync(txtFilePath, "utf8");
    const lines = content.split("\n");

    const fontSize = 21;
    const lineHeight = fontSize * 1.6;
    const padding = 40;
    const iconSize = 14;
    const width = 900;
    const height = lines.length * lineHeight + padding * 2;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Arka plan
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${fontSize}px "DejaVu Sans Mono"`;
    ctx.textBaseline = "top";

    lines.forEach((line, i) => {
        const y = padding + i * lineHeight;

        let rawLine = line.trim();
        let color = "#ffffff";

        if (rawLine.includes("📁")) {
            color = "#4e9a06"; // yeşil klasör
        } else if (rawLine.includes("📄")) {
            color = "#729fcf"; // mavi dosya
        }

        // kutu çizimi
        ctx.fillStyle = color;
        ctx.fillRect(padding, y + 2, iconSize, iconSize);

        // metin çizimi
        ctx.fillStyle = "#eeeeee";
        ctx.fillText(
            rawLine.replace(/📁 |📄 /g, ""),
            padding + iconSize + 10,
            y
        );
    });

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outputPath, buffer);
}

function activate(context) {
    const disposableCanvas = vscode.commands.registerCommand(
        "project-map.generateCanvasPNG",
        async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage("No folder opened.");
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            let txtPath = await generateText(rootPath);
            const pngPath = path.join(rootPath, "project-map.png");
            drawMapAsPNG(txtPath, pngPath);
            vscode.window
                .showInformationMessage(
                    "🧭 Project map saved as 'project-map.png'. You want to open?",
                    "Open File"
                )
                .then((selection) => {
                    if (selection === "Open File") {
                        const openPath = vscode.Uri.file(
                            path.join(rootPath, "project-map.png")
                        );
                        vscode.window.showTextDocument(openPath);
                    }
                });
        }
    );

    context.subscriptions.push(disposableCanvas);

    const disposable = vscode.commands.registerCommand(
        "project-map.generate",
        async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage("No folder opened.");
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            await generateText(rootPath);

            vscode.window
                .showInformationMessage(
                    "🧭 Project map saved as 'project-map.txt'. You want to open?",
                    "Open File"
                )
                .then((selection) => {
                    if (selection === "Open File") {
                        const openPath = vscode.Uri.file(
                            path.join(rootPath, "project-map.txt")
                        );
                        vscode.window.showTextDocument(openPath);
                    }
                });
        }
    );

    context.subscriptions.push(disposable);
}

async function generateText(rootPath) {
    const items = fs.readdirSync(rootPath);

    const choices = items.map((item) => {
        const fullPath = path.join(rootPath, item);
        const isDir = fs.statSync(fullPath).isDirectory();
        const icon = isDir ? "📁" : "📄";
        return {
            label: `${icon} ${item}`,
            fullPath: fullPath,
            picked: true,
        };
    });

    const selected = await vscode.window.showQuickPick(choices, {
        canPickMany: true,
        placeHolder: "Select the files/folders to include in project map",
    });

    if (!selected || selected.length === 0) {
        vscode.window.showWarningMessage("No selection made.");
        return;
    }

    let fullOutput = "";

    for (const choice of selected) {
        const isDir = fs.statSync(choice.fullPath).isDirectory();
        if (isDir) {
            fullOutput += `${choice.label}\n`;
            fullOutput += generateTree(choice.fullPath, "   ");
        } else {
            fullOutput += `📄 ${path.basename(choice.fullPath)}\n`;
        }
    }

    const outputPath = path.join(rootPath, "project-map.txt");
    fs.writeFileSync(outputPath, fullOutput, "utf8");
    return outputPath;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
