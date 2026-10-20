(() => {
    "use strict";
    const htmlFilesInput = document.getElementById("htmlFiles");
    const fileInfo = document.getElementById("fileInfo");
    const dialogueCount = document.getElementById("dialogueCount");
    const statusMessage = document.getElementById("statusMessage");
    const messageList = document.getElementById("messageList");
    const emptyMessage = document.getElementById("emptyMessage");
    const copyButton = document.getElementById("copyHtmlButton");
    const topBar = document.getElementById("editorTopBar");
    if (
        !htmlFilesInput ||
        !fileInfo ||
        !dialogueCount ||
        !statusMessage ||
        !messageList ||
        !emptyMessage ||
        !copyButton ||
        !topBar
    ) {
        console.error(
            "CCVN Editor: 필요한 HTML 요소를 찾을 수 없습니다. index.html을 확인해 주세요."
        );
        return;
    }
    let dialogues = [];
    let importedFiles = [];
    let sourceStyles = [];
    let avatarStyles = [];
    let nextDialogueId = 0;
    let nextFileStyleId = 0;
    const interfaceStyle = document.createElement("style");
    interfaceStyle.textContent = `
        .app-header,
        .import-panel,
        .import-panel h2,
        .import-panel p,
        .file-info,
        .status-message,
        .empty-message {
            text-align: center;
        }
        .import-panel {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .import-panel input[type="file"] {
            margin-left: auto;
            margin-right: auto;
        }
        \#editorTopBar {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            margin: 16px auto;
            padding: 0 24px;
        }
        \#copyHtmlButton {
            cursor: pointer;
        }
        .channel-label {
            display: inline-block;
            padding: 2px 7px;
            margin-right: 6px;
            background-color: #d2d2d2;
            color: #444;
            border-radius: 5px;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.5;
            vertical-align: middle;
            white-space: nowrap;
            pointer-events: none;
            cursor: default;
            user-select: none;
        }
        @media (max-width: 480px) {
            \#editorTopBar {
                padding: 0 12px;
            }
        }
    `;
    document.head.appendChild(interfaceStyle);
    statusMessage.style.whiteSpace = "pre-line";
    fileInfo.style.whiteSpace = "pre-line";
    let importedAvatarStyle = document.getElementById(
        "importedAvatarStyles"
    );
    if (!importedAvatarStyle) {
        importedAvatarStyle = document.createElement("style");
        importedAvatarStyle.id = "importedAvatarStyles";
        document.head.appendChild(importedAvatarStyle);
    }
    function createElement(tag, className = "", text = "") {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (text !== "") {
            element.textContent = text;
        }
        return element;
    }
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    function normalizeWhitespace(value) {
        return String(value ?? "")
            .replace(/\s+/g, " ")
            .trim();
    }
    function normalizeChannelName(value) {
        return String(value ?? "")
            .normalize("NFKC")
            .normalize("NFC")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .trim();
    }
    function getChannelFromFilename(filename) {
        const normalizedFilename = normalizeChannelName(filename);
        const nameWithoutExtension = normalizedFilename.replace(
            /\.[^.]+$/,
            ""
        );
        const match = nameWithoutExtension.match(
            /(?:\[([^\[\]]+)\]|［([^［］]+)］)\s*$/
        );
        if (!match) {
            return "main";
        }
        const channelName = normalizeChannelName(
            match[1] ?? match[2]
        );
        const comparableName = channelName.replace(/\s+/g, "");
        if (comparableName === "메인") {
            return "main";
        }
        return channelName || "main";
    }
    function collectInlineCss(doc) {
        return Array.from(doc.querySelectorAll("style"))
            .map(style => style.textContent || "")
            .filter(Boolean);
    }
    function namespaceAvatarCss(cssText, filePrefix) {
        return cssText.replace(
            /\.avatar-(?:file-\d+-)?image-([\w-]+)/g,
            `.${filePrefix}-image-$1`
        );
    }
    function namespaceAvatarClass(className, filePrefix) {
        return className.replace(
            /\bavatar-(?:file-\d+-)?image-([\w-]+)/g,
            `${filePrefix}-image-$1`
        );
    }
    function collectAvatarCss(cssTexts) {
        const collected = [];
        for (const cssText of cssTexts) {
            const rules = cssText.matchAll(
                /\.avatar-file-\d+-image-[\w-]+\s*\{[^}]*\}/g
            );
            for (const rule of rules) {
                collected.push(rule[0]);
            }
        }
        return [...new Set(collected)];
    }
    function refreshAvatarStyles() {
        importedAvatarStyle.textContent = avatarStyles.join("\n\n");
    }
    function collectLinkStyles(doc) {
        return Array.from(
            doc.querySelectorAll('link[rel="stylesheet"][href]')
        ).map(link => link.getAttribute("href"));
    }
    function getTimestamp(element) {
        const timeElement = element.querySelector("time[datetime]");
        if (timeElement) {
            const parsed = Date.parse(
                timeElement.getAttribute("datetime")
            );
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
        const visibleTime = element.querySelector("time");
        if (visibleTime) {
            const parsed = Date.parse(
                visibleTime.textContent.trim()
            );
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
        return null;
    }
    function formatTimestamp(timestamp) {
        if (!Number.isFinite(timestamp)) {
            return "";
        }
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        const period = hours < 12 ? "오전" : "오후";
        const displayHour = hours % 12 || 12;
        return `${year}. ${month}. ${day}. ${period} ${String(displayHour).padStart(2, "0")}:${minutes}:${seconds}`;
    }
    function parseHtmlFile(file, htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const fileChannel = getChannelFromFilename(file.name);
        const filePrefix = `avatar-file-${nextFileStyleId++}`;
        const originalCss = collectInlineCss(doc);
        const transformedCss = originalCss.map(cssText =>
            namespaceAvatarCss(cssText, filePrefix)
        );
        sourceStyles.push(...transformedCss);
        avatarStyles.push(...collectAvatarCss(transformedCss));
        refreshAvatarStyles();
        const titleElement = doc.querySelector(
            ".log-title, title, h1"
        );
        const logTitle = titleElement
            ? titleElement.textContent.trim()
            : file.name;
        const messageElements = Array.from(
            doc.querySelectorAll("article.message")
        );
        const fallbackElements = messageElements.length
            ? messageElements
            : Array.from(doc.querySelectorAll(".message"));
        const parsedDialogues = [];
        let previousTimestamp = null;
        fallbackElements.forEach((element, index) => {
            const isSystem = element.classList.contains("system");
            const timestamp = getTimestamp(element);
            let sortTimestamp = timestamp;
            if (timestamp !== null) {
                previousTimestamp = timestamp;
            } else if (isSystem && previousTimestamp !== null) {
                sortTimestamp = previousTimestamp + 1000;
                previousTimestamp = sortTimestamp;
            }
            const speakerElement = element.querySelector(".speaker");
            const messageTextElement = element.querySelector(".message-text");
            const rollElements = Array.from(
                element.querySelectorAll(".roll-result")
            );
            const headerElement = element.querySelector(".message-header");
            const timeElement = element.querySelector("time");
            const speaker = speakerElement
                ? speakerElement.textContent.trim()
                : "";
            const speakerColor = speakerElement
                ? speakerElement.style
                    .getPropertyValue("--speaker-color")
                    .trim()
                : "";
            const messageText = messageTextElement
                ? messageTextElement.innerHTML
                : "";
            const messageTextPlain = messageTextElement
                ? messageTextElement.textContent
                : element.textContent;
            const rollResults = rollElements.map(roll => ({
                html: roll.innerHTML,
                className: roll.className
            }));
            const avatarElement = element.querySelector(".avatar");
            let avatarClass = "";
            if (avatarElement) {
                avatarClass = Array.from(avatarElement.classList)
                    .filter(name =>
                        /^avatar-(?:file-\d+-)?image-[\w-]+$/.test(name)
                    )
                    .map(name => namespaceAvatarClass(name, filePrefix))
                    .join(" ");
            }
            const channel = fileChannel;
            if (
                !speaker &&
                !normalizeWhitespace(messageTextPlain) &&
                rollResults.length === 0 &&
                !isSystem
            ) {
                return;
            }
            parsedDialogues.push({
                id: nextDialogueId++,
                sourceFile: file.name,
                sourceTitle: logTitle,
                sourceIndex: index,
                channel,
                isSystem,
                timestamp,
                sortTimestamp,
                displayTimestamp: timestamp !== null
                    ? formatTimestamp(timestamp)
                    : "",
                speaker,
                speakerColor,
                messageText,
                messageTextPlain,
                rollResults,
                avatarClass,
                messageClass: element.className,
                dataChannel: element.getAttribute("data-channel") || "",
                headerHtml: headerElement
                    ? headerElement.innerHTML
                    : "",
                timeHtml: timeElement
                    ? timeElement.outerHTML
                    : ""
            });
        });
        return {
            filename: file.name,
            title: logTitle,
            dialogues: parsedDialogues,
            linkedStyles: collectLinkStyles(doc)
        };
    }
    htmlFilesInput.addEventListener("change", async event => {
        const selectedFiles = Array.from(
            event.target.files || []
        );
        if (selectedFiles.length === 0) {
            return;
        }
        const htmlFiles = selectedFiles.filter(file =>
            /\.(html?|HTML?)$/.test(file.name)
        );
        if (htmlFiles.length === 0) {
            statusMessage.textContent =
                "HTML 파일(.html, .htm)을 선택해 주세요.";
            htmlFilesInput.value = "";
            return;
        }
        let addedFileCount = 0;
        const errors = [];
        for (const file of htmlFiles) {
            if (importedFiles.some(item => item.name === file.name)) {
                continue;
            }
            try {
                const htmlText = await file.text();
                const result = parseHtmlFile(file, htmlText);
                importedFiles.push({
                    name: file.name,
                    title: result.title,
                    linkedStyles: result.linkedStyles
                });
                dialogues.push(...result.dialogues);
                addedFileCount++;
            } catch (error) {
                console.error(
                    `파일 읽기 오류: ${file.name}`,
                    error
                );
                errors.push(`${file.name}: 파일을 읽지 못했습니다.`);
            }
        }
        sortDialogues();
        renderDialogues();
        updateFileInfo();
        const statusLines = [
            `이번에 추가한 파일 ${addedFileCount}개`,
            `누적 HTML 파일 ${importedFiles.length}개`,
            `누적 대사 ${dialogues.length}개`
        ];
        if (addedFileCount === 0 && errors.length === 0) {
            statusLines.unshift(
                "새로 추가된 파일이 없습니다. 이미 불러온 파일인지 확인해 주세요."
            );
        }
        if (errors.length > 0) {
            statusLines.push(...errors);
        }
        statusMessage.textContent = statusLines.join("\n");
        htmlFilesInput.value = "";
    });
    function sortDialogues() {
        dialogues.sort((a, b) => {
            if (
                a.sortTimestamp === null &&
                b.sortTimestamp !== null
            ) {
                return 1;
            }
            if (
                a.sortTimestamp !== null &&
                b.sortTimestamp === null
            ) {
                return -1;
            }
            if (
                a.sortTimestamp !== null &&
                b.sortTimestamp !== null &&
                a.sortTimestamp !== b.sortTimestamp
            ) {
                return a.sortTimestamp - b.sortTimestamp;
            }
            const fileA = importedFiles.findIndex(
                file => file.name === a.sourceFile
            );
            const fileB = importedFiles.findIndex(
                file => file.name === b.sourceFile
            );
            if (fileA !== fileB) {
                return fileA - fileB;
            }
            return a.sourceIndex - b.sourceIndex;
        });
    }
    function updateFileInfo() {
        if (importedFiles.length === 0) {
            fileInfo.textContent = "아직 불러온 파일이 없습니다.";
            return;
        }
        fileInfo.textContent = importedFiles
            .map(file => file.name)
            .join("\n");
        fileInfo.style.whiteSpace = "pre-line";
    }
    function appendChannelLabel(parent, channel) {
        if (!channel || channel === "main") {
            return;
        }
        const label = createElement(
            "span",
            "channel-label",
            channel
        );
        label.setAttribute("aria-disabled", "true");
        label.setAttribute("role", "note");
        label.setAttribute("tabindex", "-1");
        parent.appendChild(label);
        parent.appendChild(document.createTextNode(" "));
    }
    function getChannelLabelHtml(channel) {
        if (!channel || channel === "main") {
            return "";
        }
        return `<span class="channel-label" aria-disabled="true" role="note" tabindex="-1">${escapeHtml(channel)}</span> `;
    }
    function renderDialogues() {
        messageList.innerHTML = "";
        dialogueCount.textContent = `${dialogues.length}개`;
        emptyMessage.style.display = dialogues.length === 0
            ? "block"
            : "none";
        dialogues.forEach(dialogue => {
            const article = createElement(
                "article",
                dialogue.messageClass || "message"
            );
            if (!article.classList.contains("message")) {
                article.classList.add("message");
            }
            if (dialogue.dataChannel) {
                article.dataset.channel = dialogue.dataChannel;
            }
            if (dialogue.isSystem) {
                article.classList.add("system");
                const textElement = createElement(
                    "div",
                    "message-text"
                );
                appendChannelLabel(textElement, dialogue.channel);
                textElement.insertAdjacentHTML(
                    "beforeend",
                    dialogue.messageText ||
                    escapeHtml(dialogue.messageTextPlain)
                );
                article.appendChild(textElement);
                dialogue.rollResults.forEach(roll => {
                    const rollElement = createElement(
                        "span",
                        roll.className || "roll-result"
                    );
                    rollElement.innerHTML = roll.html;
                    article.appendChild(rollElement);
                });
                messageList.appendChild(article);
                return;
            }
            if (dialogue.avatarClass) {
                const avatar = createElement(
                    "span",
                    `avatar ${dialogue.avatarClass}`
                );
                avatar.setAttribute("aria-hidden", "true");
                article.appendChild(avatar);
            } else {
                article.appendChild(
                    createElement("span", "avatar-spacer")
                );
            }
            const content = createElement(
                "div",
                "message-content"
            );
            const header = createElement(
                "div",
                "message-header"
            );
            const speaker = createElement(
                "span",
                "speaker",
                dialogue.speaker
            );
            if (dialogue.speakerColor) {
                speaker.style.setProperty(
                    "--speaker-color",
                    dialogue.speakerColor
                );
            }
            header.appendChild(speaker);
            if (dialogue.displayTimestamp) {
                const time = createElement(
                    "time",
                    "timestamp",
                    dialogue.displayTimestamp
                );
                if (dialogue.timestamp !== null) {
                    time.dateTime = new Date(
                        dialogue.timestamp
                    ).toISOString();
                }
                header.appendChild(time);
            }
            content.appendChild(header);
            const textElement = createElement(
                "div",
                "message-text"
            );
            appendChannelLabel(textElement, dialogue.channel);
            textElement.insertAdjacentHTML(
                "beforeend",
                dialogue.messageText ||
                escapeHtml(dialogue.messageTextPlain)
            );
            content.appendChild(textElement);
            dialogue.rollResults.forEach(roll => {
                const rollElement = createElement(
                    "span",
                    roll.className || "roll-result"
                );
                rollElement.innerHTML = roll.html;
                content.appendChild(rollElement);
            });
            article.appendChild(content);
            messageList.appendChild(article);
        });
    }
    function buildCanonicalAvatarExport() {
        const classMap = new Map();
        const canonicalRules = [];
        const imageToCanonicalClass = new Map();
        let nextImageId = 0;
        const avatarRulePattern = /\.((?:avatar-file-\d+-)?image-[\w-]+)\s*\{([^}]*)\}/g;
        for (const cssText of sourceStyles) {
            let match;
            while ((match = avatarRulePattern.exec(cssText)) !== null) {
                const sourceClass = match[1];
                const body = match[2];
                const imageMatch = body.match(/background-image\s*:\s*url\((.*?)\)\s*;/is);
                const imageValue = imageMatch
                    ? imageMatch[1].trim().replace(/^(["'])(.*)\1$/, "$2")
                    : body.trim();
                let canonicalClass = imageToCanonicalClass.get(imageValue);
                if (!canonicalClass) {
                    canonicalClass = `avatar-image-${nextImageId++}`;
                    imageToCanonicalClass.set(imageValue, canonicalClass);
                    canonicalRules.push(`.${canonicalClass} {${body}}`);
                }
                classMap.set(sourceClass, canonicalClass);
            }
            avatarRulePattern.lastIndex = 0;
        }
        return { classMap, canonicalRules };
    }
    function createExportHtml() {
        const title = importedFiles.length > 0
            ? importedFiles.map(file => file.title).join(" / ")
            : "CCVN Editor";
        const avatarExport = buildCanonicalAvatarExport();
        const messageHtml = dialogues.map(dialogue => {
            const channelLabel = getChannelLabelHtml(
                dialogue.channel
            );
            if (dialogue.isSystem) {
                const systemText =
                    dialogue.messageText ||
                    escapeHtml(dialogue.messageTextPlain);
                const rolls = dialogue.rollResults.map(roll =>
                    `<span class="${escapeHtml(roll.className || "roll-result")}">${roll.html}</span>`
                ).join("\n");
                return `
<article class="message system" data-channel="${escapeHtml(dialogue.dataChannel || "main")}">
    <div class="message-text">${channelLabel}${systemText}</div>
    ${rolls}
</article>`.trim();
            }
            const exportedAvatarClass = dialogue.avatarClass
                .split(/\s+/)
                .map(className => avatarExport.classMap.get(className) || className)
                .join(" ")
                .trim();
            const avatar = exportedAvatarClass
                ? `<span class="avatar ${escapeHtml(exportedAvatarClass)}" aria-hidden="true"></span>`
                : `<span class="avatar-spacer"></span>`;
            const speakerStyle = dialogue.speakerColor
                ? ` style="--speaker-color:${escapeHtml(dialogue.speakerColor)}"`
                : "";
            const timeHtml = dialogue.timestamp !== null
                ? `<time class="timestamp" datetime="${new Date(dialogue.timestamp).toISOString()}">${escapeHtml(dialogue.displayTimestamp)}</time>`
                : "";
            const textHtml =
                dialogue.messageText ||
                escapeHtml(dialogue.messageTextPlain);
            const rolls = dialogue.rollResults.map(roll =>
                `<span class="${escapeHtml(roll.className || "roll-result")}">${roll.html}</span>`
            ).join("\n");
            return `
<article class="message" data-channel="${escapeHtml(dialogue.dataChannel || "main")}">
    ${avatar}
    <div class="message-content">
        <div class="message-header">
            <span class="speaker"${speakerStyle}>${escapeHtml(dialogue.speaker)}</span>
            ${timeHtml}
        </div>
        <div class="message-text">${channelLabel}${textHtml}</div>
        ${rolls}
    </div>
</article>`.trim();
        }).join("\n\n");
        const allCss = getExportCss(avatarExport);
        return `<!DOCTYPE html>
<html lang="ko-KR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title></title>
    <style>
${allCss}
    </style>
</head>
<body>
<main class="message-list">
    ${messageHtml}
</main>
</body>
</html>`;
    }
    function getExportCss(avatarExport) {
        const cssParts = [];
        Array.from(document.styleSheets).forEach(sheet => {
            try {
                if (
                    sheet.ownerNode &&
                    sheet.ownerNode.id === "importedAvatarStyles"
                ) {
                    return;
                }
                const rules = Array.from(sheet.cssRules || []);
                if (rules.length > 0) {
                    cssParts.push(
                        rules.map(rule => rule.cssText).join("\n")
                    );
                }
            } catch (error) {
                console.warn(
                    "일부 CSS를 읽지 못했습니다:",
                    sheet.href || error
                );
            }
        });
        const avatarRulePattern = /\.avatar-(?:file-\d+-)?image-[\w-]+\s*\{[^}]*\}/g;
        for (const cssText of sourceStyles) {
            const cleanedCss = cssText.replace(avatarRulePattern, "").trim();
            if (cleanedCss) cssParts.push(cleanedCss);
        }
        cssParts.push(...avatarExport.canonicalRules);
        cssParts.push(`
            body {
                margin: 0;
                background: #f5f5f5;
                color: #222;
            }
            * {
                box-sizing: border-box;
            }
            .message-list {
                width: 100%;
                max-width: 960px;
                margin: 0 auto;
                padding: 0 24px 48px;
                color: #eee;
                background: #121212;
            }
            .log-title {
                margin: 24px 0;
                font-size: 24px;
            }
            .message {
                display: grid;
                grid-template-columns: 40px minmax(0, 1fr);
                column-gap: 12px;
                padding: 16px 0;
                border-bottom: 1px solid #262626;
            }
            .message.system {
                display: block;
                padding-left: 52px;
                color: #888;
            }
            .avatar,
            .avatar-spacer {
                width: 40px;
                height: 40px;
            }
            .avatar {
                display: block;
                background-repeat: no-repeat;
                background-size: 100% 100%;
            }
            .message-content {
                min-width: 0;
            }
            .message-header {
                display: flex;
                align-items: baseline;
                flex-wrap: wrap;
                gap: 8px;
            }
            .speaker {
                color: var(--speaker-color);
                font-size: 14px;
                font-weight: bold;
            }
            .timestamp {
                color: #888;
                font-size: 12px;
            }
            .message-text,
            .roll-result {
                font-size: 16px;
                line-height: 1.6;
                overflow-wrap: anywhere;
                white-space: pre-wrap;
            }
            .roll-result {
                display: block;
                color: #888;
            }
            .roll-result.success,
            .roll-result.critical {
                color: #2196f3;
            }
            .roll-result.failure,
            .roll-result.fumble {
                color: #dc004e;
            }
            .channel-label {
                display: inline-block;
                padding: 2px 7px;
                margin-right: 6px;
                background-color: #d2d2d2;
                color: #444;
                border-radius: 5px;
                font-size: 12px;
                font-weight: 500;
                line-height: 1.5;
                vertical-align: middle;
                white-space: nowrap;
                pointer-events: none;
                cursor: default;
                user-select: none;
            }
        `);
        return [...new Set(cssParts.filter(Boolean))].join("\n\n");
    }
    copyButton.addEventListener("click", async () => {
        if (dialogues.length === 0) {
            statusMessage.textContent =
                "먼저 HTML 파일을 불러와 주세요.";
            return;
        }
        const exportHtml = createExportHtml();
        try {
            await navigator.clipboard.writeText(exportHtml);
            statusMessage.textContent =
                `HTML 복사가 완료되었습니다.\n누적 HTML 파일 ${importedFiles.length}개 · 대사 ${dialogues.length}개`;
        } catch (error) {
            const textarea = document.createElement("textarea");
            textarea.value = exportHtml;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand("copy");
            textarea.remove();
            statusMessage.textContent = copied
                ? `HTML 복사가 완료되었습니다.\n누적 HTML 파일 ${importedFiles.length}개 · 대사 ${dialogues.length}개`
                : "복사에 실패했습니다. localhost 또는 HTTPS 환경에서 실행해 주세요.";
        }
    });
    window.CCVNEditor = {
        createExportHtml
    };
    updateFileInfo();
    renderDialogues();
})();