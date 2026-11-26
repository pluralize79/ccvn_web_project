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

        // =====================================
        // 1. 파일 읽기
        // =====================================

        const htmlText = await htmlFile.text();
        const jsonText = await jsonFile.text();

        const jsonData = JSON.parse(jsonText);

        if (!Array.isArray(jsonData.messages)) {
            throw new Error('JSON에 messages 배열이 없습니다.');
        }

        // =====================================
        // 2. HTML 파싱
        // =====================================

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

        // HTML의 시간 있는 대사 순서
        const htmlTimestampOrder = new Map();

        // 시간 없는 시스템 메시지 개수
        const htmlSystemMessages = new Map();

        let htmlOrder = 0;

        htmlMessages.forEach(article => {

            const timeElement = article.querySelector('time');

            const messageElement = article.querySelector(
                '.message-text'
            );

            if (!messageElement) return;

            // 시간 기록이 있는 대사
            if (timeElement) {

                const timestamp = new Date(
                    timeElement.getAttribute('datetime')
                ).getTime();

                if (!Number.isNaN(timestamp)) {

                    if (!htmlTimestampOrder.has(timestamp)) {
                        htmlTimestampOrder.set(
                            timestamp,
                            htmlOrder++
                        );
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

        // =====================================
        // 3. JSON에 임시 인덱스 부여
        // =====================================

        const indexedMessages = [];

        let majorIndex = 0;
        let minorIndex = 0;

        jsonData.messages.forEach((message, originalIndex) => {

            const timestamp = Number(message.createdAt);

            // 시간 기록이 있는 대사
            if (Number.isFinite(timestamp)) {

                majorIndex++;
                minorIndex = 0;

                // HTML에 없는 대사는 제외
                if (!htmlTimestampOrder.has(timestamp)) {
                    return;
                }

                indexedMessages.push({
                    message,
                    originalIndex,
                    major: majorIndex,
                    minor: 0,
                    timestamp,
                    isTimed: true
                });

                return;
            }

            // 시간 기록이 없는 시스템 메시지
            if (message.type === 'system') {

                minorIndex++;

                const text = normalizeText(message.text);

                const count = htmlSystemMessages.get(text) || 0;

                // HTML에 없는 시스템 메시지는 제외
                if (count <= 0) {
                    return;
                }

                htmlSystemMessages.set(text, count - 1);

                indexedMessages.push({
                    message,
                    originalIndex,
                    major: majorIndex,
                    minor: minorIndex,
                    timestamp: null,
                    isTimed: false
                });
            }

        });

        // =====================================
        // 4. 시간 있는 대사만 HTML 순서로 정렬
        // =====================================

        const timedMessages = indexedMessages
            .filter(item => item.isTimed)
            .sort((a, b) => {

                const orderA = htmlTimestampOrder.get(
                    a.timestamp
                );

                const orderB = htmlTimestampOrder.get(
                    b.timestamp
                );

                if (orderA !== orderB) {
                    return orderA - orderB;
                }

                // 동일한 시간일 경우 기존 JSON 순서 유지
                return a.originalIndex - b.originalIndex;
            });

        // =====================================
        // 5. 기존 인덱스와 새로운 인덱스 연결
        // =====================================

        const newMajorIndexes = new Map();

        timedMessages.forEach((item, index) => {

            const newMajor = index + 1;

            newMajorIndexes.set(
                item.major,
                newMajor
            );

            item.major = newMajor;
        });

        // 시스템 메시지도 직전 대사와 함께 이동
        indexedMessages.forEach(item => {

            if (item.isTimed) return;

            if (newMajorIndexes.has(item.major)) {

                item.major = newMajorIndexes.get(
                    item.major
                );
            }

        });

        // =====================================
        // 6. 인덱스 순서대로 전체 메시지 정렬
        // =====================================

        indexedMessages.sort((a, b) => {

            // 정수 부분 비교
            if (a.major !== b.major) {
                return a.major - b.major;
            }

            // 소수 부분 비교
            if (a.minor !== b.minor) {
                return a.minor - b.minor;
            }

            // 동률이면 기존 JSON 순서 유지
            return a.originalIndex - b.originalIndex;
        });

        // =====================================
        // 7. 임시 인덱스를 제거하고 결과 생성
        // =====================================

        const reorderedMessages = indexedMessages.map(
            item => item.message
        );

        const result = {
            ...jsonData,
            messages: reorderedMessages
        };

        // =====================================
        // 8. JSON 다운로드
        // =====================================

        const blob = new Blob(
            [JSON.stringify(result, null, 2)],
            {
                type: 'application/json;charset=utf-8'
            }
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

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        // =====================================
        // 9. 결과 안내
        // =====================================

        status.textContent =
            `추출 완료! 전체 ${jsonData.messages.length}개 중 ` +
            `${reorderedMessages.length}개를 추출했습니다. ` +
            'HTML 순서에 맞춰 정렬했습니다.';

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
