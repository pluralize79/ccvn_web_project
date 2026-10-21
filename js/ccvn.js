
(() => {
    "use strict";

    const STORAGE_KEY = "ccvnVisualNovelHtml";
    const AUTO_PLAY_DELAY = 3000;

    const $ = (id) => document.getElementById(id);

    const closeButton = $("closeButton");
    const autoButton = $("autoButton");
    const backButton = $("backButton");
    const sceneCounter = $("sceneCounter");
    const vnCharacter = $("vnCharacter");
    const vnCharacterShell = $("vnCharacterShell");
    const vnAvatar = $("vnAvatar");
    const vnDialogueArea = $("vnDialogueArea");
    const vnSpeaker = $("vnSpeaker");
    const vnDialogue = $("vnDialogue");
    const vnMessage = $("vnMessage");
    const emptyMessage = $("emptyMessage");
    const vnStatus = $("vnStatus");

    let scenes = [];
    let currentIndex = 0;
    let autoPlaying = false;
    let autoTimer = null;

    // 원본 HTML의 스타일시트를 가져옵니다.
    function importOriginalStyles(doc) {
        const currentPageUrl = window.location.href;
        const addedStylesheets = new Set();

        doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
            const href = link.getAttribute("href");

            if (!href) return;

            try {
                const url = new URL(href, currentPageUrl).href;

                if (addedStylesheets.has(url)) return;
                addedStylesheets.add(url);

                const stylesheet = document.createElement("link");
                stylesheet.rel = "stylesheet";
                stylesheet.href = url;

                document.head.appendChild(stylesheet);
            } catch (error) {
                console.warn("원본 CSS를 불러오지 못했습니다.", href);
            }
        });

        doc.querySelectorAll("style").forEach((style) => {
            const newStyle = document.createElement("style");
            newStyle.textContent = style.textContent;
            document.head.appendChild(newStyle);
        });
    }

    // 원본 HTML에서 대사와 캐릭터 정보를 추출합니다.
    function extractScenes(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        importOriginalStyles(doc);

        let elements = [
            ...doc.querySelectorAll("article.message")
        ];

        if (elements.length === 0) {
            elements = [
                ...doc.querySelectorAll(".message-card")
            ];
        }

        if (elements.length === 0) {
            elements = [
                ...doc.querySelectorAll("[data-message]")
            ];
        }

        return elements.map((element) => {
            const avatar = element.querySelector(".avatar");
            const speaker = element.querySelector(".speaker")
                || element.querySelector(".message-speaker");

            const messageText = element.querySelector(".message-text")
                || element.querySelector(".message-content")
                || element.querySelector(".text");

            const avatarClone = avatar
                ? avatar.cloneNode(true)
                : null;

            let messageHtml = "";

            if (messageText) {
                const clone = messageText.cloneNode(true);

                // 실행 가능한 스크립트 및 폼 요소는 제외합니다.
                clone.querySelectorAll(
                    "script, iframe, object, embed, form"
                ).forEach((node) => node.remove());

                messageHtml = clone.innerHTML;
            }

            return {
                speaker: speaker ? speaker.textContent.trim() : "",
                messageHtml,
                avatar: avatarClone
            };
        }).filter((scene) => {
            return scene.speaker ||
                scene.messageHtml.trim() ||
                scene.avatar;
        });
    }

    function stopAutoPlay() {
        autoPlaying = false;

        if (autoTimer !== null) {
            clearTimeout(autoTimer);
            autoTimer = null;
        }

        autoButton.textContent = "Auto";
        autoButton.setAttribute("aria-pressed", "false");
    }

    function updateCounter() {
        sceneCounter.textContent = scenes.length
            ? `${currentIndex + 1} / ${scenes.length}`
            : "0 / 0";
    }

    function renderScene() {
        if (scenes.length === 0) return;

        const scene = scenes[currentIndex];

        vnSpeaker.textContent = scene.speaker;
        vnMessage.innerHTML = scene.messageHtml;

        // 이전 캐릭터의 표정 클래스를 제거합니다.
        vnAvatar.className = "avatar";
        vnAvatar.removeAttribute("style");

        // 원본 avatar 요소의 클래스와 배경 이미지를 복사합니다.
        if (scene.avatar) {
            vnAvatar.className = scene.avatar.className;

            if (!vnAvatar.classList.contains("avatar")) {
                vnAvatar.classList.add("avatar");
            }

            const inlineStyle = scene.avatar.getAttribute("style");

            if (inlineStyle) {
                vnAvatar.setAttribute("style", inlineStyle);
            }

            // 원본의 표정 클래스 유지
            scene.avatar.classList.forEach((className) => {
                if (
                    className.startsWith("avatar-image-") &&
                    !vnAvatar.classList.contains(className)
                ) {
                    vnAvatar.classList.add(className);
                }
            });
        }

        updateCounter();
    }

    function goToScene(index) {
        if (index < 0 || index >= scenes.length) return;

        currentIndex = index;
        renderScene();

        if (autoPlaying) {
            scheduleNextScene();
        }
    }

    function nextScene() {
        if (currentIndex < scenes.length - 1) {
            goToScene(currentIndex + 1);
        } else {
            stopAutoPlay();
            vnStatus.textContent = "마지막 대사입니다.";
        }
    }

    function previousScene() {
        if (currentIndex > 0) {
            goToScene(currentIndex - 1);
        }
    }

    function scheduleNextScene() {
        if (autoTimer !== null) {
            clearTimeout(autoTimer);
            autoTimer = null;
        }

        if (!autoPlaying) return;

        if (currentIndex >= scenes.length - 1) {
            stopAutoPlay();
            return;
        }

        autoTimer = setTimeout(() => {
            if (!autoPlaying) return;

            currentIndex += 1;
            renderScene();
            scheduleNextScene();
        }, AUTO_PLAY_DELAY);
    }

    function toggleAutoPlay() {
        if (scenes.length === 0) return;

        if (autoPlaying) {
            stopAutoPlay();
            vnStatus.textContent = "자동 재생을 정지했습니다.";
            return;
        }

        if (currentIndex >= scenes.length - 1) {
            currentIndex = 0;
            renderScene();
        }

        autoPlaying = true;
        autoButton.textContent = "Auto ■";
        autoButton.setAttribute("aria-pressed", "true");
        vnStatus.textContent = "자동 재생 중";

        scheduleNextScene();
    }

    function showError(message) {
        vnCharacter.hidden = true;
        vnDialogueArea.hidden = true;
        emptyMessage.hidden = false;

        emptyMessage.replaceChildren();

        const title = document.createElement("strong");
        title.textContent = "로그를 불러올 수 없습니다.";

        const description = document.createElement("p");
        description.textContent = message;

        emptyMessage.append(title, description);
        updateCounter();
    }

    function initialize() {
        let html = "";

        try {
            html = sessionStorage.getItem(STORAGE_KEY) || "";
        } catch (error) {
            showError("브라우저 저장 공간에서 로그를 읽지 못했습니다.");
            return;
        }

        if (!html.trim()) {
            showError(
                "편집기로 돌아가서 비주얼 노벨 시작 버튼을 눌러 주세요."
            );
            return;
        }

        try {
            scenes = extractScenes(html);
        } catch (error) {
            console.error("HTML 파싱 오류:", error);

            showError("원본 HTML을 분석하는 중 오류가 발생했습니다.");
            return;
        }

        if (scenes.length === 0) {
            console.error("대사 요소를 찾을 수 없습니다.", html.slice(0, 1500));

            showError(
                "원본 HTML에서 대사를 찾지 못했습니다. " +
                "대사 요소의 클래스가 .message, .speaker, " +
                ".message-text인지 확인해 주세요."
            );
            return;
        }

        emptyMessage.hidden = true;
        vnCharacter.hidden = false;
        vnDialogueArea.hidden = false;

        currentIndex = 0;
        renderScene();
    }

    // 닫기: 편집기로 복귀
    closeButton.addEventListener("click", () => {
        stopAutoPlay();
        window.location.href = "index.html";
    });

    // back: 이전 대사
    backButton.addEventListener("click", previousScene);

    // Auto: 자동 재생 토글
    autoButton.addEventListener("click", toggleAutoPlay);

    // 대화창: 다음 대사
    vnDialogue.addEventListener("click", nextScene);

    // 키보드 조작
    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") {
            nextScene();
        } else if (event.key === "ArrowLeft") {
            previousScene();
        } else if (event.code === "Space") {
            event.preventDefault();
            toggleAutoPlay();
        } else if (event.key === "Escape") {
            stopAutoPlay();
        }
    });

    initialize();
})();
