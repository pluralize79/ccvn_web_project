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
    let baseStyles = null;
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
        const nameWithoutExtension = normalizedFilename.replace(/\.[^.]+$/, "");
        const match = nameWithoutExtension.match(/(?:\[([^\[\]]+)\]|［([^［］]+)］)\s*$/);
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
        return cssText.replace(/\.avatar-(?:file-\d+-)?image-([\w-]+)/g, `.${filePrefix}-image-$1`);
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
            const rules = cssText.matchAll(/\.avatar-file-\d+-image-[\w-]+\s*\{[^}]*\}/g);
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

        // 첫 번째 HTML의 CSS만 기본 서식으로 사용한다.
        // 이후 HTML에서는 아바타 CSS만 별도로 수집한다.
        if (baseStyles === null) {
            baseStyles = transformedCss.slice();
        }

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
        const htmlFiles = selectedFiles.filter(file => /\.html?$/i.test(file.name));
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
                    ? imageMatch[1].trim().replace(/^(["'])(.\*)\1$/, "$2")
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
<div class="message-log-container">
    <main class="message-list">
        ${messageHtml}
    </main>
</div>
</body>
</html>`;
    }
    // CSS 안에서 :root 규칙은 첫 번째 규칙만 유지하고 이후 것은 제거한다.
    // @media / @supports 안에 들어 있는 :root도 동일하게 처리한다.
    function keepFirstRootRule(cssText, rootState) {
        const tempStyle = document.createElement("style");
        tempStyle.textContent = cssText;
        document.head.appendChild(tempStyle);

        try {
            const processRules = rules => {
                const output = [];

                for (const rule of Array.from(rules || [])) {
                    // 일반 스타일 규칙
                    if (rule.type === CSSRule.STYLE_RULE) {
                        if (/(^|,)\s*:root(?:\b|\s|\.)/i.test(rule.selectorText)) {
                            if (rootState.kept) continue;
                            rootState.kept = true;
                        }
                        output.push(rule.cssText);
                        continue;
                    }

                    // @media, @supports, @layer 등 하위 규칙을 가진 그룹 규칙
                    if (rule.cssRules) {
                        const original = rule.cssText;
                        const braceIndex = original.indexOf("{");
                        if (braceIndex >= 0) {
                            const inner = processRules(rule.cssRules);
                            if (inner) {
                                output.push(
                                    original.slice(0, braceIndex + 1) +
                                    "\n" + inner + "\n}"
                                );
                            }
                        } else {
                            output.push(original);
                        }
                        continue;
                    }

                    output.push(rule.cssText);
                }

                return output.join("\n");
            };

            return processRules(tempStyle.sheet?.cssRules || []);
        } catch (error) {
            console.warn(" :root CSS 정리 중 오류:", error);
            return cssText;
        } finally {
            tempStyle.remove();
        }
    }

        // 색상 문자열의 상대적인 밝기를 계산한다.
    function getColorBrightness(value) {
        const text = String(value || "").trim().toLowerCase();
        let rgb = null;

        const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

        if (hex) {
            let value = hex[1];

            if (value.length === 3) {
                value = value.split("")
                    .map(char => char + char)
                    .join("");
            }

            rgb = [0, 2, 4].map(index =>
                parseInt(value.slice(index, index + 2), 16)
            );
        } else {
            const match = text.match(
                /rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i
            );

            if (match) {
                rgb = match.slice(1, 4).map(Number);
            }
        }

        if (!rgb) return null;

        const channels = rgb.map(channel => {
            const normalized = channel / 255;

            return normalized <= 0.04045
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });

        return (
            channels[0] * 0.2126 +
            channels[1] * 0.7152 +
            channels[2] * 0.0722
        );
    }


    // 다크 모드 CSS만 제거한다.
    // 일반 테마의 배경색, 글자색, 장식 서식은 보존한다.
    function removeDarkModeCss(cssText) {
        const tempStyle = document.createElement("style");
        tempStyle.textContent = cssText;
        document.head.appendChild(tempStyle);

        try {
            function processRules(rules) {
                const output = [];

                for (const rule of Array.from(rules || [])) {

                    // 시스템 다크 모드 규칙은 내부 서식을 유지하면서
                    // 항상 적용되는 규칙으로 변환
                    if (
                        rule.type === CSSRule.MEDIA_RULE &&
                        /prefers-color-scheme\s*:\s*dark/i.test(
                            rule.conditionText || ""
                        )
                    ) {
                        output.push(
                            ...processRules(rule.cssRules)
                        );
                        continue;
                    }

                    // 시스템 라이트 모드 전용 규칙은 제외
                    if (
                        rule.type === CSSRule.MEDIA_RULE &&
                        /prefers-color-scheme\s*:\s*light/i.test(
                            rule.conditionText || ""
                        )
                    ) {
                        continue;
                    }

                    // 일반 CSS 규칙
                    if (rule.type === CSSRule.STYLE_RULE) {
                        const style = rule.style;

                        const scheme = style
                            .getPropertyValue("color-scheme")
                            .trim()
                            .toLowerCase();

                        if (/\bdark\b/i.test(scheme)) {
                            style.setProperty(
                                "color-scheme",
                                "light"
                            );
                        }

                        output.push(
                            `${rule.selectorText} { ${style.cssText} }`
                        );

                        continue;
                    }

                    // 다른 그룹 규칙 내부도 처리
                    if (rule.cssRules) {
                        const nested = processRules(rule.cssRules);

                        if (nested.length) {
                            const braceIndex = rule.cssText.indexOf("{");

                            output.push(
                                rule.cssText.slice(0, braceIndex + 1) +
                                "\n" +
                                nested.join("\n") +
                                "\n}"
                            );
                        }

                        continue;
                    }

                    output.push(rule.cssText);
                }

                return output;
            }

            const result = processRules(
                tempStyle.sheet?.cssRules || []
            );

            result.push(`
                :root {
                    color-scheme: light;
                }
            `);

            return result.join("\n");

        } catch (error) {
            console.warn("CSS 색상 모드 정리 중 오류:", error);
            return cssText;

        } finally {
            tempStyle.remove();
        }
    }

    function scopeExportCss(cssText) {
        const tempStyle = document.createElement("style");
        tempStyle.textContent = cssText;
        document.head.appendChild(tempStyle);

        const wrapper = ".message-log-container";

        // 선택자 목록을 괄호 안의 쉼표와 구분해서 분리
        function splitSelectors(selectorText) {
            const result = [];
            let current = "";
            let depth = 0;
            let quote = "";
            let escaped = false;

            for (const char of selectorText) {
                if (escaped) {
                    current += char;
                    escaped = false;
                    continue;
                }

                if (char === "\\") {
                    current += char;
                    escaped = true;
                    continue;
                }

                if (quote) {
                    current += char;
                    if (char === quote) quote = "";
                    continue;
                }

                if (char === '"' || char === "'") {
                    quote = char;
                    current += char;
                    continue;
                }

                if (char === "(" || char === "[") depth++;
                if (char === ")" || char === "]") depth--;

                if (char === "," && depth === 0) {
                    result.push(current.trim());
                    current = "";
                } else {
                    current += char;
                }
            }

            if (current.trim()) {
                result.push(current.trim());
            }

            return result;
        }

        function scopeSelector(selector) {
            let scoped = selector.replace(
                /(^|[\s>+~,(])(?:html|body|:root)(?=$|[\s>+~.#:[,)])/gi,
                "$1" + wrapper
            );

            // html, body, :root가 아닌 일반 선택자는
            // 채팅 로그 컨테이너 아래에 적용
            if (!scoped.startsWith(wrapper)) {
                scoped = `${wrapper} ${scoped}`;
            }

            // 중복된 컨테이너 선택자 정리
            scoped = scoped.replace(
                /(\.message-log-container)\s+\.message-log-container/g,
                "$1"
            );

            return scoped;
        }

        function processRules(rules) {
            const output = [];

            for (const rule of Array.from(rules || [])) {

                // 일반 CSS 선택자
                if (
                    rule.type === CSSRule.STYLE_RULE &&
                    rule.selectorText
                ) {
                    const selectors = splitSelectors(rule.selectorText)
                        .map(scopeSelector);

                    output.push(
                        `${selectors.join(", ")} { ${rule.style.cssText} }`
                    );

                    continue;
                }

                // @media, @supports, @keyframes 등의 그룹 규칙
                if (rule.cssRules) {
                    const nested = processRules(rule.cssRules);

                    if (nested.length) {
                        const braceIndex = rule.cssText.indexOf("{");

                        output.push(
                            rule.cssText.slice(0, braceIndex + 1) +
                            "\n" +
                            nested.join("\n") +
                            "\n}"
                        );
                    }

                    continue;
                }

                // @font-face 등 선택자가 없는 규칙
                output.push(rule.cssText);
            }

            return output;
        }

        try {
            return processRules(
                tempStyle.sheet?.cssRules || []
            ).join("\n");

        } catch (error) {
            console.warn("CSS 범위 제한 중 오류:", error);
            return cssText;

        } finally {
            tempStyle.remove();
        }
    }

    
    // CSS 문자열을 CSSOM으로 변환
    function parseCssRules(cssText) {
        const style = document.createElement("style");
        style.textContent = cssText;
        document.head.appendChild(style);

        const rules = [];

        try {
            for (const rule of Array.from(style.sheet?.cssRules || [])) {
                if (rule.type === CSSRule.STYLE_RULE) {
                    rules.push(rule);
                }
            }
        } catch (error) {
            console.warn("CSS 분석 오류:", error);
        } finally {
            style.remove();
        }

        return rules;
    }

    // 현재 편집기 CSS에서 첫 번째 HTML에 없는 속성만 추출
    function collectMissingCss(baseCssTexts) {
        const baseProperties = new Map();

        // 첫 번째 HTML의 CSS 속성 수집
        for (const cssText of baseCssTexts) {
            for (const rule of parseCssRules(cssText)) {
                const selector = rule.selectorText.trim();

                if (!baseProperties.has(selector)) {
                    baseProperties.set(selector, new Set());
                }

                for (const property of Array.from(rule.style)) {
                    baseProperties.get(selector).add(property);
                }
            }
        }

        const missingRules = new Map();

        // 편집기에서 사용 중인 CSS 수집
        for (const sheet of Array.from(document.styleSheets)) {
            if (sheet.ownerNode?.id === "importedAvatarStyles") {
                continue;
            }

            let rules;

            try {
                rules = sheet.cssRules;
            } catch (error) {
                continue;
            }

            for (const rule of Array.from(rules || [])) {
                if (rule.type !== CSSRule.STYLE_RULE) {
                    continue;
                }

                const selectors = rule.selectorText
                    .split(",")
                    .map(selector => selector.trim());

                for (const selector of selectors) {
                    // 메시지 출력과 관련된 CSS만 허용
                    const relevant =
                        selector === "*" ||
                        /(^|[\s>+~,(])(html|body|:root)(?=$|[\s>+~.#:[,)])/i.test(selector) ||
                        /message-list|message-content|message-header|message-text|message\b|avatar|avatar-spacer|speaker|timestamp|edited|channel-name|channel-label|roll-result/.test(selector);

                    if (!relevant) continue;

                    const existing = baseProperties.get(selector) || new Set();

                    const declarations = [];

                    for (const property of Array.from(rule.style)) {
                        // 첫 번째 HTML에 이미 존재하는 속성은 제외
                        if (existing.has(property)) continue;

                        const value = rule.style.getPropertyValue(property);
                        const priority = rule.style.getPropertyPriority(property);

                        declarations.push(
                            `${property}: ${value}${priority ? " !important" : ""};`
                        );
                    }

                    if (declarations.length === 0) continue;

                    if (!missingRules.has(selector)) {
                        missingRules.set(selector, new Map());
                    }

                    const properties = missingRules.get(selector);

                    for (const property of Array.from(rule.style)) {
                        if (existing.has(property)) continue;

                        properties.set(
                            property,
                            `${property}: ${rule.style.getPropertyValue(property)}${rule.style.getPropertyPriority(property) ? " !important" : ""};`
                        );
                    }
                }
            }
        }

        return Array.from(missingRules.entries())
            .map(([selector, properties]) =>
                `${selector} {\n    ${Array.from(properties.values()).join("\n    ")}\n}`
            )
            .join("\n\n");
    }

    // 최종 CSS 생성
    function getExportCss(avatarExport) {
        const cssParts = [];

        const avatarRulePattern =
            /\.avatar-(?:file-\d+-)?image-[\w-]+\s*\{[^}]*\}/g;

        // 1. 첫 번째 HTML의 CSS를 기본으로 사용
        for (const cssText of (baseStyles || [])) {
            const withoutAvatar = cssText
                .replace(avatarRulePattern, "")
                .trim();

            if (!withoutAvatar) continue;

            const cleanedCss = removeDarkModeCss(withoutAvatar);

            if (cleanedCss.trim()) {
                cssParts.push(cleanedCss);
            }
        }

        // 2. 첫 번째 HTML에 없는 편집기 CSS만 추가
        const missingCss = collectMissingCss(
            baseStyles || []
        );

        if (missingCss) {
            cssParts.push(missingCss);
        }

        // 3. 여러 HTML에서 모은 아바타 CSS 통합
        cssParts.push(...avatarExport.canonicalRules);

        // 4. 최소 레이아웃 보완
        cssParts.push(`
            * {
                box-sizing: border-box;
            }

            .message-list {
                width: 100%;
                max-width: 960px;
                margin: 0 auto;
                padding: 0 24px 48px;
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

            .message-text,
            .roll-result {
                overflow-wrap: anywhere;
                white-space: pre-wrap;
            }
        `);

        // 5. 중복 CSS 규칙 제거
        const uniqueRules = new Set();
        const result = [];

        cssParts.filter(Boolean).forEach(cssText => {
            const tempStyle = document.createElement("style");
            tempStyle.textContent = cssText;
            document.head.appendChild(tempStyle);

            try {
                const rules = Array.from(
                    tempStyle.sheet?.cssRules || []
                );

                if (rules.length) {
                    rules.forEach(rule => {
                        const ruleText = rule.cssText.trim();

                        if (ruleText && !uniqueRules.has(ruleText)) {
                            uniqueRules.add(ruleText);
                            result.push(ruleText);
                        }
                    });
                } else {
                    const fallback = cssText.trim();

                    if (fallback && !uniqueRules.has(fallback)) {
                        uniqueRules.add(fallback);
                        result.push(fallback);
                    }
                }
            } catch (error) {
                console.warn("CSS 중복 제거 중 오류:", error);
                result.push(cssText);
            } finally {
                tempStyle.remove();
            }
        });

        // 6. 내보내기 영역에 CSS 적용 범위 제한
        return scopeExportCss(result.join("\n\n"));
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