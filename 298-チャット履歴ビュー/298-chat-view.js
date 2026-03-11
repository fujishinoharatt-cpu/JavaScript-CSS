(function () {
    'use strict';

    // =========================================================
    // 設定エリア
    // =========================================================
    const CONFIG = {
        VIEW_ID: 'chat-view-root',
        FIELDS: {
            RECORD_NUMBER: 'レコード番号',
            LINE_ID: 'line_id',
            USER_NAME: 'user_name',
            // ユーザー指定のフィールドコード
            MESSAGE_CONTENT: 'message_content',
            DIRECTION: 'direction',
            MESSAGE_TYPE: 'message_type',
            TIMESTAMP: 'timestamp',
            ATTACHMENT: 'attachment' // 添付ファイル
        },
        DIRECTION_VALUES: {
            USER: 'USER',
            BOT: 'BOT'
        }
    };

    // =========================================================
    // メイン処理
    // =========================================================
    kintone.events.on('app.record.index.show', function (event) {
        const container = document.getElementById(CONFIG.VIEW_ID);
        if (!container) return event;

        container.classList.add('kintone-chat-container');

        // -----------------------------------------------------
        // レコード全件取得ロジック
        // -----------------------------------------------------
        const MAX_READ_LIMIT = 500; // 一度の取得件数

        const fetchAllRecords = (opt_offset, opt_records) => {
            const offset = opt_offset || 0;
            const allRecords = opt_records || [];

            // ユーザーに進捗を表示
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">
                読み込み中... (${allRecords.length}件取得済み)
            </div>`;

            // FETCH query: $id でソートして全件確実に取る
            const query = `order by $id asc limit ${MAX_READ_LIMIT} offset ${offset}`;
            const body = {
                'app': kintone.app.getId(),
                'query': query
            };

            return kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body).then(function (resp) {
                const newRecords = resp.records;
                const currentRecords = allRecords.concat(newRecords);

                if (newRecords.length === MAX_READ_LIMIT) {
                    // まだある場合は再帰呼び出し
                    return fetchAllRecords(offset + MAX_READ_LIMIT, currentRecords);
                } else {
                    return currentRecords;
                }
            });
        };

        // 実行
        fetchAllRecords().then(function (records) {
            container.innerHTML = ''; // Loadingクリア

            // ここで日時順にソート (Timestamp昇順)
            records.sort(function (a, b) {
                const tA = (a[CONFIG.FIELDS.TIMESTAMP] && a[CONFIG.FIELDS.TIMESTAMP].value) || '';
                const tB = (b[CONFIG.FIELDS.TIMESTAMP] && b[CONFIG.FIELDS.TIMESTAMP].value) || '';
                if (tA < tB) return -1;
                if (tA > tB) return 1;
                return 0;
            });

            renderChat(container, records);
        }).catch(function (error) {
            container.innerHTML = '';
            const errorMsg = document.createElement('div');
            let detail = error.message || JSON.stringify(error);
            errorMsg.innerText = '取得エラー:\n' + detail;
            errorMsg.style.color = 'red';
            errorMsg.style.backgroundColor = 'white';
            errorMsg.style.padding = '10px';
            container.appendChild(errorMsg);
        });

        // single API calls removed in favor of fetchAllRecords
        /*
        const query = 'order by ' + CONFIG.FIELDS.TIMESTAMP + ' asc limit 500';

        const body = {
            'app': kintone.app.getId(),
            'query': query
        };

        kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body, function (resp) {
            container.innerHTML = ''; // Loadingクリア
            renderChat(container, resp.records);
        }, function (error) {
            container.innerHTML = '';
            const errorMsg = document.createElement('div');
            let detail = error.message || JSON.stringify(error);
            errorMsg.innerText = '取得エラー:\n' + detail;
            errorMsg.style.color = 'red';
            errorMsg.style.backgroundColor = 'white';
            errorMsg.style.padding = '10px';
            container.appendChild(errorMsg);
        });
        */

        return event;
    });

    /**
     * 描画ロジック
     */
    function renderChat(container, records) {
        if (!records || records.length === 0) {
            container.innerText = 'メッセージがありません。';
            container.style.color = '#fff';
            return;
        }

        // -----------------------------------------------------
        // ユーザー抽出とフィルタメニュー作成
        // -----------------------------------------------------
        const headerArea = document.createElement('div');
        headerArea.classList.add('chat-header-area');

        const selectBox = document.createElement('select');
        selectBox.classList.add('chat-filter-select');

        // ユニークなユーザーを抽出 (LineIDと名前のペア)
        const userMap = new Map();
        records.forEach(r => {
            const lid = (r[CONFIG.FIELDS.LINE_ID] && r[CONFIG.FIELDS.LINE_ID].value) || '';
            const paramName = (r[CONFIG.FIELDS.USER_NAME] && r[CONFIG.FIELDS.USER_NAME].value) || 'Noname';
            // LineIDがある場合のみリストに追加
            if (lid) {
                // 名前が取得できているものを優先して保存
                if (!userMap.has(lid) || (userMap.get(lid) === 'Noname' && paramName !== 'Noname')) {
                    userMap.set(lid, paramName);
                }
            }
        });

        // デフォルト選択肢
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = `すべてのユーザーを表示 (${userMap.size}人)`;
        selectBox.appendChild(defaultOption);

        // 名前順にソートして表示
        const sortedUsers = Array.from(userMap.entries()).sort((a, b) => {
            return a[1].localeCompare(b[1], 'ja');
        });

        console.log('ChatView: User Map Created', sortedUsers);

        sortedUsers.forEach((entry) => {
            const id = entry[0];
            const name = entry[1];
            const opt = document.createElement('option');
            opt.value = id;
            opt.text = `${name}`;
            selectBox.appendChild(opt);
        });

        // フィルタイベント
        selectBox.addEventListener('change', function (e) {
            const selectedId = e.target.value;
            // フィルタ対象コンテナを渡す
            filterMessages(messageListDiv, selectedId);
        });

        headerArea.appendChild(selectBox);

        // 件数表示を追加 (ユーザー数も表示)
        // 件数表示を追加 (ユーザー数も表示)
        const countDisplay = document.createElement('div');
        countDisplay.innerText = `総メッセージ数: ${records.length}件 / 検出ユーザー数: ${userMap.size}人`;
        countDisplay.style.fontSize = '14px';
        countDisplay.style.color = '#333';
        countDisplay.style.marginTop = '4px';
        headerArea.appendChild(countDisplay);

        container.appendChild(headerArea);

        // -----------------------------------------------------
        // メッセージ本体の描画 (スクロールエリア)
        // -----------------------------------------------------
        const messageListDiv = document.createElement('div');
        messageListDiv.classList.add('chat-message-list-area');
        messageListDiv.id = 'chat-message-list';
        container.appendChild(messageListDiv);

        let lastDateStr = '';

        records.forEach(function (record) {
            try {
                const rawDirection = (record[CONFIG.FIELDS.DIRECTION] && record[CONFIG.FIELDS.DIRECTION].value) || '';
                const rawMessage = (record[CONFIG.FIELDS.MESSAGE_CONTENT] && record[CONFIG.FIELDS.MESSAGE_CONTENT].value) || '';
                const rawTime = (record[CONFIG.FIELDS.TIMESTAMP] && record[CONFIG.FIELDS.TIMESTAMP].value) || '';
                const rawName = (record[CONFIG.FIELDS.USER_NAME] && record[CONFIG.FIELDS.USER_NAME].value) || 'Name';
                const rawType = (record[CONFIG.FIELDS.MESSAGE_TYPE] && record[CONFIG.FIELDS.MESSAGE_TYPE].value) || '';
                const rawLineId = (record[CONFIG.FIELDS.LINE_ID] && record[CONFIG.FIELDS.LINE_ID].value) || '';
                const rawAttachment = (record[CONFIG.FIELDS.ATTACHMENT] && record[CONFIG.FIELDS.ATTACHMENT].value) || [];
                // レコードIDもデバッグ用に取得
                const recId = record[CONFIG.FIELDS.RECORD_NUMBER] && record[CONFIG.FIELDS.RECORD_NUMBER].value;

                const displayMessage = rawMessage ? rawMessage : ''; // メッセージなしでも画像がある場合を考慮

                const dateObj = new Date(rawTime);
                let timeStr = '';
                let fullDateStr = '';
                let currentDateStr = ''; // 日付判定用

                if (isValidDate(dateObj)) {
                    timeStr = dateObj.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                    fullDateStr = dateObj.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    currentDateStr = dateObj.toLocaleDateString('ja-JP'); // "YYYY/MM/DD"
                }

                // 日付が変わったら区切り線を挿入
                if (currentDateStr && currentDateStr !== lastDateStr) {
                    const dateDivider = document.createElement('div');
                    dateDivider.classList.add('chat-date-divider');
                    // フィルタ時に消せるようにクラスか属性をつける？今回は「区切り」なので残すか、制御するか。
                    // フィルタ時は「そのユーザーの会話」になるので、日付もフィルタリング対象に含めるロジックが必要になるが、
                    // シンプルに実装するため、まずDOMには追加する。
                    // ※フィルタ機能で display:none する際、これらのdividerをどうするかは要検討だが、
                    // 一旦はチャットフローの一部として追加。フィルタ処理側で考慮が必要かもしれない。
                    // あるいはフィルタ時は日付またぎが飛び飛びになるので、都度レンダリングしなおすのがベストだが、
                    // 今回は既存DOM操作なので、dividerに line-id は紐づかない。
                    // -> フィルタ時にdividerをどうするか？
                    // ひとまず dataset.isDivider = true をつけておく
                    dateDivider.dataset.isDivider = 'true';
                    dateDivider.dataset.date = currentDateStr;

                    const dateLabel = document.createElement('div');
                    dateLabel.classList.add('chat-date-label');
                    // "2025/01/21 (火)" の形式
                    dateLabel.innerText = dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });

                    dateDivider.appendChild(dateLabel);
                    messageListDiv.appendChild(dateDivider);

                    lastDateStr = currentDateStr;
                }

                const rowDiv = document.createElement('div');
                rowDiv.classList.add('chat-row');
                // フィルタ用に data-line-id 属性をセット
                if (rawLineId) {
                    rowDiv.dataset.lineId = rawLineId;
                }

                // 送信者によって左右振り分け
                // USER -> 左, BOT -> 右 (LINE風)
                const isUser = (rawDirection === CONFIG.DIRECTION_VALUES.USER);

                if (isUser) {
                    rowDiv.classList.add('chat-row-left');
                } else {
                    rowDiv.classList.add('chat-row-right');
                }

                const msgRow = document.createElement('div');
                msgRow.classList.add('chat-message-row');

                // 左側(USER)の場合はアイコンや名前を表示してもよいが、今回は名前を吹き出し上に表示

                const bubble = document.createElement('div');
                bubble.classList.add('chat-bubble');
                if (isUser) {
                    bubble.classList.add('chat-bubble-white');
                } else {
                    bubble.classList.add('chat-bubble-green');
                }

                // 画像コンテンツの生成

                // メッセージがあればリンク化し、bubbleに追加 (画像より先に表示)
                if (displayMessage) {
                    const textSpan = document.createElement('span');
                    // URL自動リンク機能は一旦無効化 (ユーザー要望によりコメントアウト的な扱い)
                    // textSpan.innerHTML = linkify(displayMessage);
                    textSpan.innerText = displayMessage;
                    bubble.appendChild(textSpan);
                } else if (!rawAttachment || rawAttachment.length === 0) {
                    // メッセージも画像もない場合
                    const emptySpan = document.createElement('span');
                    emptySpan.style.color = '#999';
                    emptySpan.style.fontSize = '12px';
                    emptySpan.innerText = '(コンテンツなし)';
                    bubble.appendChild(emptySpan);
                }

                let attachmentHtml = '';
                if (rawAttachment && rawAttachment.length > 0) {
                    // 複数のファイルがある場合も考慮してループするか、今回は1つ目を表示するか
                    rawAttachment.forEach(file => {
                        const wrapperFn = document.createElement('div');
                        wrapperFn.classList.add('chat-image-wrapper');

                        const imgFn = document.createElement('img');
                        imgFn.alt = file.name;
                        imgFn.classList.add('chat-image-content');

                        // Kintone File APIは X-Requested-With ヘッダが必要なため、img src直接指定では403/400エラーになることが多い
                        // XHR/FetchでBlobとして取得してから表示する
                        fetchImage(file.fileKey, imgFn);

                        wrapperFn.appendChild(imgFn);
                        // HTML文字列ではなくElementとして扱いたいが、既存ロジックがinnerHTML結合なので
                        // 一旦HTMLとして結合するのは難しい -> 構造を変える必要がある
                        bubble.appendChild(wrapperFn);
                    });
                }

                const timeDiv = document.createElement('div');
                timeDiv.classList.add('chat-time-label');
                timeDiv.innerText = timeStr;
                timeDiv.title = fullDateStr + (rawType ? ` [${rawType}]` : '');

                if (isUser) {
                    // 左(相手): [Bubble] [Time]
                    msgRow.appendChild(bubble);
                    msgRow.appendChild(timeDiv);
                } else {
                    // 右(自分): [Time] [Bubble]
                    msgRow.appendChild(timeDiv);
                    msgRow.appendChild(bubble);
                }

                rowDiv.appendChild(msgRow);
                messageListDiv.appendChild(rowDiv);
            } catch (e) {
                console.error('Render Error Record:', record, e);
            }
        });

        // 最下部へスクロール (messageListDiv自体をスクロールさせる)
        messageListDiv.scrollTop = messageListDiv.scrollHeight;
    }

    /**
     * メッセージのフィルタリング実行
     */
    function filterMessages(container, targetLineId) {
        // containerは messageListDiv
        const rows = container.querySelectorAll('.chat-row');
        rows.forEach(row => {
            const rowId = row.dataset.lineId;
            // 未選択(全表示) または ID一致 または IDを持っていない(Botなど紐づかないレコードがある場合? 今回はBotもLineIDを持つ想定か、紐づくUserのIDを持つかによる)
            // 通常、LINE連携アプリではBot送信分も同じLineIDを持つはず。
            // もしBot側にLineIDが入っていない場合、フィルタすると消えてしまうので注意。
            // Kintoneのデータ構造として、1つのLineIDに対するスレッドであればBot側も同じLineIDが入っているはず。

            if (!targetLineId || rowId === targetLineId) {
                row.style.display = 'flex';
            } else {
                row.style.display = 'none';
            }
        });

        // フィルタ変更時もスクロールを一番下へ（あるいは上へ？）今回は下へ
        container.scrollTop = container.scrollHeight;
    }

    function isValidDate(d) {
        return d instanceof Date && !isNaN(d);
    }

    /**
     * テキスト内のURLをリンクに変換する (XSS対策済み)
     */
    function linkify(text) {
        if (!text) return '';
        // 1. HTMLエスケープ (XSS対策)
        const escapedText = escapeHtml(text);

        // 2. URLをリンクタグに置換
        // http:// または https:// で始まり、半角空白・タブ・改行・全角空白(<br>等含む)などの区切り文字までをURLとみなす
        // 簡易的な正規表現
        const urlRegex = /(https?:\/\/[^\s\u3000]+)/g;

        return escapedText.replace(urlRegex, function (url) {
            let tail = '';
            // 末尾が ) で終わっている場合、URLの構成要素ではなく文脈上の括弧閉じとみなして除外する
            while (url.endsWith(')')) {
                url = url.slice(0, -1);
                tail = ')' + tail;
            }
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #0066cc; text-decoration: underline;">${url}</a>${tail}`;
        });
    }

    /**
     * HTMLエスケープ処理
     */
    function escapeHtml(string) {
        if (typeof string !== 'string') return string;
        return string.replace(/[&'`"<>]/g, function (match) {
            return {
                '&': '&amp;',
                "'": '&#x27;',
                '`': '&#x60;',
                '"': '&quot;',
                '<': '&lt;',
                '>': '&gt;',
            }[match];
        });
    }

    /**
     * Kintone File APIから画像をBlobとして取得して表示する
     * (X-Requested-Withヘッダ対策)
     * クリックでダウンロード可能にする
     */
    function fetchImage(fileKey, imgElement, fileName) {
        const url = kintone.api.url('/k/v1/file', true) + '?fileKey=' + fileKey;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.responseType = 'blob';

        xhr.onload = function () {
            if (xhr.status === 200) {
                const blob = xhr.response;
                const blobUrl = window.URL.createObjectURL(blob);
                imgElement.src = blobUrl;

                // クリックイベントでダウンロード
                imgElement.onclick = function () {
                    if (window.navigator.msSaveBlob) {
                        // IE/Edge legacy
                        window.navigator.msSaveBlob(blob, fileName);
                    } else {
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = fileName || 'download.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }
                };

            } else {
                console.error('Failed to fetch image:', xhr.status, xhr.statusText);
                // エラー時はaltテキストなどを表示するなど
            }
        };

        xhr.onerror = function () {
            console.error('Network error fetching image');
        };

        xhr.send();
    }

})();
