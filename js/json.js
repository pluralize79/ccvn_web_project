document.getElementById('compareExportButton')
    .addEventListener('click', async () => {

    const htmlInput = document.getElementById('compareHtmlFile');
    const jsonInput = document.getElementById('compareJsonFile');
    const status = document.getElementById('compareExportStatus');
    const button = document.getElementById('compareExportButton');

    try {
        const htmlFile = htmlInput.files[0];
        const jsonFile = jsonInput.files[0];

        if (!htmlFile || !jsonFile) {
            alert('HTML 파일과 JSON 파일을 모두 선택해주세요.');
            return;
        }

        button.disabled = true;
        status.textContent = '파일을 읽는 중입니다...';

        // 1. 파일 읽기
        const htmlText = await htmlFile.text();
        const jsonText = await jsonFile.text();

        const jsonData = JSON.parse(jsonText);

        if (!Array.isArray(jsonData.messages)) {
            throw new Error('JSON에 messages 배열이 없습니다.');
        }

        // 2. HTML 파싱
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(
            htmlText,
            'text/html'
        );

        const htmlMessages = htmlDoc.querySelectorAll(
            'article.message'
        );

        function normalizeText(text) {
            return (text || '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        // 3. HTML의 타임스탬프와 순서 수집
        const htmlTimestamps = new Set();
        const htmlTimestampOrder = new Map();

        // 타임스탬프가 없는 시스템 메시지 수집
        const htmlSystemMessages = new Map();

        htmlMessages.forEach((article, htmlIndex) => {

            const timeElement = article.querySelector('time');
            const messageElement = article.querySelector(
                '.message-text'
            );

            if (!messageElement) return;

            // 시간 기록이 있는 메시지
            if (timeElement) {

                const timestamp = new Date(
                    timeElement.getAttribute('datetime')
                ).getTime();

                if (!Number.isNaN(timestamp)) {

                    htmlTimestamps.add(timestamp);

                    // HTML에서 등장한 순서를 기록
                    if (!htmlTimestampOrder.has(timestamp)) {
                        htmlTimestampOrder.set(timestamp, htmlIndex);
                    }
                }
            }

            // 시간 기록이 없는 시스템 메시지
            else if (article.classList.contains('system')) {

                const text = normalizeText(
                    messageElement.textContent
                );

                htmlSystemMessages.set(
                    text,
                    (htmlSystemMessages.get(text) || 0) + 1
                );
            }

        });

        // 4. HTML에 존재하는 메시지만 필터링
        const filteredMessages = jsonData.messages.filter(message => {

            const timestamp = Number(message.createdAt);

            // 작성 시각이 HTML과 일치하면 유지
            if (
                Number.isFinite(timestamp) &&
                htmlTimestamps.has(timestamp)
            ) {
                return true;
            }

            // 시간 기록이 없는 시스템 메시지 비교
            if (message.type === 'system') {

                const text = normalizeText(message.text);
                const count = htmlSystemMessages.get(text) || 0;

                if (count > 0) {

                    htmlSystemMessages.set(text, count - 1);

                    return true;
                }
            }

            return false;

        });

        // 5. 시간 기록이 있는 메시지만 HTML 순서로 정렬
        const timedMessages = filteredMessages
            .map((message, originalIndex) => ({
                message,
                originalIndex,
                timestamp: Number(message.createdAt)
            }))
            .filter(item =>
                Number.isFinite(item.timestamp) &&
                htmlTimestampOrder.has(item.timestamp)
            )
            .sort((a, b) => {

                const orderA = htmlTimestampOrder.get(a.timestamp);
                const orderB = htmlTimestampOrder.get(b.timestamp);

                // HTML에 등장한 순서 우선
                if (orderA !== orderB) {
                    return orderA - orderB;
                }

                // 같은 시간일 경우 기존 JSON 순서 유지
                return a.originalIndex - b.originalIndex;
            });

        // 6. 기존 JSON에서 시간 기록이 있던 자리만 교체
        let timedIndex = 0;

        const reorderedMessages = filteredMessages.map(message => {

            const timestamp = Number(message.createdAt);

            // HTML과 일치하는 시간 기록이 있는 메시지만 교체
            if (
                Number.isFinite(timestamp) &&
                htmlTimestampOrder.has(timestamp)
            ) {
                return timedMessages[timedIndex++].message;
            }

            // 시간 기록이 없는 메시지는 원래 위치 유지
            return message;
        });

        // 7. 기존 JSON 구조 유지
        const result = {
            ...jsonData,
            messages: reorderedMessages
        };

        // 8. JSON 다운로드
        const blob = new Blob(
            [JSON.stringify(result, null, 2)],
            { type: 'application/json;charset=utf-8' }
        );

        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');

        downloadLink.href = url;

        downloadLink.download =
            jsonFile.name.replace(/\.json$/i, '') +
            '_HTML_FILTERED.json';

        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        // 다운로드 URL 해제
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        // 9. 결과 안내
        status.textContent =
            `추출 완료! 전체 ${jsonData.messages.length}개 중 ` +
            `${reorderedMessages.length}개를 추출했습니다. ` +
            `HTML 순서에 맞춰 시간 기록이 있는 대사를 정렬했습니다.`;

    } catch (error) {

        console.error('HTML 대사 추출 오류:', error);

        status.textContent =
            '오류가 발생했습니다: ' + error.message;

        alert(
            '파일 처리 중 오류가 발생했습니다.\n' +
            error.message
        );

    } finally {
        button.disabled = false;
    }

});
