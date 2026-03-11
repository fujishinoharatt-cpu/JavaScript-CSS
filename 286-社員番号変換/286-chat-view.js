(function () {
    'use strict';
    // =========================================================
    // 設定エリア
    // =========================================================
    const CONFIG = {
        SPACE_ID: 'chat_space',      // 空白スペースの要素ID
        APP_ID_HISTORY: 298,         // 履歴アプリ
        APP_ID_SEND: 299,            // 送信アプリ
        APP_ID_DELIVERY: 300,        // 定期配信アプリ
        FIELDS_286: {
            LINE_USER_ID: 'line_id' // アプリ286のLINEユーザーIDのフィールドコード
        },
        FIELDS_298: {
            MESSAGE_CONTENT: 'message_content',
            DIRECTION: 'direction',
            TIMESTAMP: 'timestamp',
            ATTACHMENT: 'attachment',
            URL: 'URL'
        },
        FIELDS_299: {
            MESSAGE_CONTENT: 'message_text',
            ATTACHMENT: 'attachment_image',
            CREATED_DATETIME: '作成日時' // 日時フィールドがないため通常は作成日時を使用
        },
        FIELDS_300: {
            MESSAGE_CONTENT: 'message_text',
            ATTACHMENT: 'attachment_image',
            DELIVERY_DATE: 'delivery_date', // 配信予定日
            CYCLE: 'cycle',
            STATUS: 'delivery_status',
            TABLE: 'recipient_table',
            TABLE_LINE_ID: 'line_id',
            TABLE_EMPLOYEE_NO: 'line_user',
            TABLE_EMPLOYEE_NAME: 'line_name'
        },
        DIRECTION_VALUES: {
            USER: 'USER',
            BOT: 'BOT'
        },
        COMPRESSION: {
            MAX_WIDTH: 1200,   // 最大横幅
            MAX_HEIGHT: 1200,  // 最大高さ
            QUALITY: 0.8       // 画質 (0.0 ~ 1.0)
        }
    };
    // 編集モードの状態管理グローバル (同一画面内で共有)
    let editingRecordId = null;
    let editorElements300 = {}; // 右カラムの各要素への参照用
    // =========================================================
    // 詳細画面表示イベント
    // =========================================================
    kintone.events.on('app.record.detail.show', function (event) {
        const record = event.record;
        const lineUserId = record[CONFIG.FIELDS_286.LINE_USER_ID] ? record[CONFIG.FIELDS_286.LINE_USER_ID].value : null;
        // 追加項目の取得 (アプリ286のフィールド名に合わせる)
        const employeeNo = record['社員NO'] ? record['社員NO'].value : '';
        const employeeName = record['氏名'] ? record['氏名'].value : '';
        const spaceElement = kintone.app.record.getSpaceElement(CONFIG.SPACE_ID);
        if (!spaceElement) {
            console.error('Chat view space element not found:', CONFIG.SPACE_ID);
            return event;
        }
        if (!lineUserId) {
            spaceElement.innerText = 'LINEユーザーIDが設定されていないため、チャット履歴を表示できません。';
            return event;
        }
        // コンテナの準備
        spaceElement.innerHTML = '';
        const container = document.createElement('div');
        container.classList.add('chat-detail-container');
        spaceElement.appendChild(container);
        // 読み込み中表示
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #fff;">データを読み込み中...</div>';
        // 両方のアプリからデータ取得
        console.log('ChatDetail: Starting fetch for LineUserId:', lineUserId);
        renderSplitLayout(container, lineUserId, { employeeNo, employeeName });
        return event;
    });
    /**
     * 2カラムレイアウトの描画とデータ取得
     */
    function renderSplitLayout(container, lineUserId, context) {
        container.innerHTML = '';
        const leftCol = document.createElement('div');
        leftCol.classList.add('chat-column');
        leftCol.innerHTML = `
            <div class="chat-column-header">チャット履歴 (298)</div>
            <div id="chat-list-history" class="chat-detail-list">Loading...</div>
        `;
        container.appendChild(leftCol);
        // 中央カラム: 送信
        const centerCol = document.createElement('div');
        centerCol.classList.add('chat-column');
        centerCol.innerHTML = `
            <div class="chat-column-header">メッセージ送信 (299)</div>
            <div id="chat-list-send" class="chat-detail-list">Loading...</div>
            <div class="chat-input-area">
                <div class="chat-file-info" id="selected-file-name-299"></div>
                <div class="chat-input-controls">
                    <label class="chat-file-btn" title="画像を添付">
                        📎
                        <input type="file" style="display:none" id="chat-file-input-299" accept="image/*">
                    </label>
                    <textarea class="chat-input-textarea" id="chat-textarea-299" placeholder="メッセージを入力"></textarea>
                </div>
                <button class="chat-send-btn" id="chat-send-btn-299">送信</button>
            </div>
        `;
        container.appendChild(centerCol);
        // 右カラム: 定期配信
        const rightCol = document.createElement('div');
        rightCol.classList.add('chat-column');
        rightCol.innerHTML = `
            <div class="chat-column-header">定期配信予約 (300)</div>
            <div id="chat-list-delivery" class="chat-detail-list">Loading...</div>
            <div class="chat-input-area" id="input-area-300">
                <div class="chat-form-row">
                    <input type="date" id="delivery-date" title="配信予定日">
                    <select id="delivery-cycle" title="サイクル">
                        <option value="1回のみ">1回のみ</option>
                        <option value="毎日">毎日</option>
                        <option value="毎週">毎週</option>
                        <option value="毎月">毎月</option>
                        <option value="毎年">毎年</option>
                    </select>
                    <select id="delivery-status" title="ステータス">
                        <option value="配信待ち">配信待ち</option>
                        <option value="配信完了">配信完了</option>
                        <option value="停止中">停止中</option>
                    </select>
                </div>
                <div class="chat-file-info" id="selected-file-name-300"></div>
                <div class="chat-input-controls">
                    <label class="chat-file-btn" title="画像を添付">
                        📎
                        <input type="file" style="display:none" id="chat-file-input-300" accept="image/*">
                    </label>
                    <textarea class="chat-input-textarea" id="chat-textarea-300" placeholder="定期配信内容" style="height:40px;"></textarea>
                </div>
                <div style="display:flex; justify-content: flex-end; gap:8px;">
                    <button class="chat-send-btn chat-cancel-btn" id="chat-cancel-btn-300" style="display:none">キャンセル</button>
                    <button class="chat-send-btn" id="chat-send-btn-300">予約登録</button>
                </div>
            </div>
        `;
        container.appendChild(rightCol);
        const historyListEl = leftCol.querySelector('#chat-list-history');
        const sendListEl = centerCol.querySelector('#chat-list-send');
        const deliveryListEl = rightCol.querySelector('#chat-list-delivery');
        const textarea299 = centerCol.querySelector('#chat-textarea-299');
        const sendBtn299 = centerCol.querySelector('#chat-send-btn-299');
        const fileInput299 = centerCol.querySelector('#chat-file-input-299');
        const fileInfo299 = centerCol.querySelector('#selected-file-name-299');
        const cycleInput300 = rightCol.querySelector('#delivery-cycle');
        const statusInput300 = rightCol.querySelector('#delivery-status');
        const inputArea300 = rightCol.querySelector('#input-area-300');
        const textarea300 = rightCol.querySelector('#chat-textarea-300');
        const sendBtn300 = rightCol.querySelector('#chat-send-btn-300');
        const cancelBtn300 = rightCol.querySelector('#chat-cancel-btn-300');
        const fileInput300 = rightCol.querySelector('#chat-file-input-300');
        const fileInfo300 = rightCol.querySelector('#selected-file-name-300');
        const dateInput300 = rightCol.querySelector('#delivery-date');
        // 他の関数(renderMessageList)から触れるように参照を保存
        editorElements300 = {
            inputArea: inputArea300,
            textarea: textarea300,
            sendBtn: sendBtn300,
            cancelBtn: cancelBtn300,
            dateInput: dateInput300,
            cycleInput: cycleInput300,
            statusInput: statusInput300,
            fileInput: fileInput300,
            fileInfo: fileInfo300
        };
        fileInput299.onchange = () => {
            if (fileInput299.files.length > 0) {
                fileInfo299.innerText = '📎 選択中: ' + fileInput299.files[0].name;
                fileInfo299.style.display = 'block';
            } else { fileInfo299.style.display = 'none'; }
        };
        editorElements300.fileInput.onchange = () => {
            if (editorElements300.fileInput.files.length > 0) {
                editorElements300.fileInfo.innerText = '📎 選択中: ' + editorElements300.fileInput.files[0].name;
                editorElements300.fileInfo.style.display = 'block';
            } else { editorElements300.fileInfo.style.display = 'none'; }
        };
        // データ取得
        Promise.all([
            fetchRecords(CONFIG.APP_ID_HISTORY, `line_id = "${lineUserId}"`),
            fetchRecords(CONFIG.APP_ID_SEND, `line_id = "${lineUserId}"`),
            fetchRecords(CONFIG.APP_ID_DELIVERY, `${CONFIG.FIELDS_300.TABLE_LINE_ID} in ("${lineUserId}")`)
        ]).then(([historyRecords, sendRecords, deliveryRecords]) => {
            renderMessageList(historyListEl, historyRecords, CONFIG.FIELDS_298);
            renderMessageList(sendListEl, sendRecords, CONFIG.FIELDS_299, true);
            renderMessageList(deliveryListEl, deliveryRecords, CONFIG.FIELDS_300, true);
        }).catch(err => {
            console.error('Fetch error:', err);
            [historyListEl, sendListEl, deliveryListEl].forEach(el => el.innerText = 'エラー: ' + err.message);
        });
        // 送信イベント (299)
        sendBtn299.onclick = async function () {
            const val = textarea299.value.trim();
            const file = fileInput299.files[0];
            if (!val && !file) return;
            sendBtn299.disabled = true;
            try {
                let fileKey = null;
                if (file) {
                    const compressed = await compressImage(file);
                    fileKey = await uploadFile(compressed, file.name || 'image.jpg');
                }
                const recordData = {
                    'line_id': { value: lineUserId },
                    '社員NO': { value: context.employeeNo },
                    '社員名': { value: context.employeeName },
                    [CONFIG.FIELDS_299.MESSAGE_CONTENT]: { value: val }
                };
                if (fileKey) recordData[CONFIG.FIELDS_299.ATTACHMENT] = { value: [{ fileKey: fileKey }] };
                await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', { app: CONFIG.APP_ID_SEND, record: recordData });
                textarea299.value = ''; fileInput299.value = ''; fileInfo299.style.display = 'none';
                const recs = await fetchRecords(CONFIG.APP_ID_SEND, `line_id = "${lineUserId}"`);
                renderMessageList(sendListEl, recs, CONFIG.FIELDS_299, true);
            } catch (err) { alert('送信エラー: ' + err.message); } finally { sendBtn299.disabled = false; }
        };
        // 編集キャンセル
        cancelBtn300.onclick = () => {
            editingRecordId = null;
            textarea300.value = '';
            dateInput300.value = '';
            cycleInput300.value = '1回のみ';
            statusInput300.value = '配信待ち';
            fileInput300.value = '';
            fileInfo300.style.display = 'none';
            inputArea300.classList.add('chat-input-area');
            inputArea300.classList.remove('editing');
            sendBtn300.innerText = '予約登録';
            cancelBtn300.style.display = 'none';
        };
        // 予約登録・更新イベント (300)
        sendBtn300.onclick = async function () {
            const val = textarea300.value.trim();
            const date = dateInput300.value;
            const file = fileInput300.files[0];
            if (!val && !file) return;
            if (!date) { alert('配信予定日を選択してください'); return; }
            sendBtn300.disabled = true;
            try {
                let fileKey = null;
                if (file) {
                    const compressed = await compressImage(file);
                    fileKey = await uploadFile(compressed, file.name || 'image.jpg');
                }
                if (editingRecordId) {
                    // 更新 (PUT)
                    const recordUpdate = {
                        [CONFIG.FIELDS_300.DELIVERY_DATE]: { value: date },
                        [CONFIG.FIELDS_300.CYCLE]: { value: cycleInput300.value },
                        [CONFIG.FIELDS_300.STATUS]: { value: statusInput300.value },
                        [CONFIG.FIELDS_300.MESSAGE_CONTENT]: { value: val }
                    };
                    if (fileKey) recordUpdate[CONFIG.FIELDS_300.ATTACHMENT] = { value: [{ fileKey: fileKey }] };
                    await kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
                        app: CONFIG.APP_ID_DELIVERY,
                        id: editingRecordId,
                        record: recordUpdate
                    });
                    alert('予約内容を更新しました');
                } else {
                    // 新規登録 (POST)
                    const subtableRow = {
                        value: {
                            [CONFIG.FIELDS_300.TABLE_LINE_ID]: { value: lineUserId },
                            [CONFIG.FIELDS_300.TABLE_EMPLOYEE_NO]: { value: Number(context.employeeNo) },
                            [CONFIG.FIELDS_300.TABLE_EMPLOYEE_NAME]: { value: context.employeeName }
                        }
                    };
                    const recordData = {
                        [CONFIG.FIELDS_300.TABLE]: { value: [subtableRow] },
                        [CONFIG.FIELDS_300.DELIVERY_DATE]: { value: date },
                        [CONFIG.FIELDS_300.CYCLE]: { value: cycleInput300.value },
                        [CONFIG.FIELDS_300.STATUS]: { value: statusInput300.value },
                        [CONFIG.FIELDS_300.MESSAGE_CONTENT]: { value: val }
                    };
                    if (fileKey) recordData[CONFIG.FIELDS_300.ATTACHMENT] = { value: [{ fileKey: fileKey }] };
                    await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', { app: CONFIG.APP_ID_DELIVERY, record: recordData });
                }
                cancelBtn300.onclick(); // フッォームクリア
                const recs = await fetchRecords(CONFIG.APP_ID_DELIVERY, `${CONFIG.FIELDS_300.TABLE_LINE_ID} in ("${lineUserId}")`);
                renderMessageList(deliveryListEl, recs, CONFIG.FIELDS_300, true);
            } catch (err) {
                console.error('Reservation Error Detail:', err);
                let errorMsg = '予約エラー: ' + err.message;
                if (err.errors) {
                    errorMsg += '\n\n詳細:';
                    for (let key in err.errors) {
                        errorMsg += `\n- ${key}: ${err.errors[key].messages.join(', ')}`;
                    }
                }
                alert(errorMsg);
            } finally { sendBtn300.disabled = false; }
        };
    }
    /**
     * ファイルアップロード
     */
    function uploadFile(blob, fileName) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
            formData.append('file', blob, fileName);
            const url = kintone.api.url('/k/v1/file', true);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText).fileKey);
                } else {
                    reject(new Error('File upload failed: ' + xhr.status));
                }
            };
            xhr.onerror = () => reject(new Error('File upload network error'));
            xhr.send(formData);
        });
    }
    /**
     * 画像圧縮
     * Canvasを使用してリサイズと画質調整を行う
     */
    function compressImage(file) {
        return new Promise((resolve) => {
            // 画像ファイル以外はそのまま通す
            if (!file.type.match(/image.*/)) {
                resolve(file);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    const maxWidth = CONFIG.COMPRESSION.MAX_WIDTH;
                    const maxHeight = CONFIG.COMPRESSION.MAX_HEIGHT;
                    // アスペクト比を維持してリサイズ計算
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    // 指定の品質でBlobに変換 (JPEG)
                    canvas.toBlob((blob) => {
                        resolve(blob || file);
                    }, 'image/jpeg', CONFIG.COMPRESSION.QUALITY);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    /**
     * 指定した要素にメッセージリストを描画する
     */
    function renderMessageList(listDiv, records, fieldMap, forceBot) {
        try {
            listDiv.innerHTML = '';
            if (records.length === 0) {
                listDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #fff; font-size:12px;">データがありません。</div>';
                return;
            }
            // 日時フィールドを特定するヘルパー
            const getTime = (r) => {
                const f = fieldMap.TIMESTAMP || fieldMap.CREATED_DATETIME || fieldMap.DELIVERY_DATE;
                if (r[f] && r[f].value) return r[f].value;
                // $created_datetime などのシステムフィールド
                if (r['作成日時'] && r['作成日時'].value) return r['作成日時'].value;
                if (r['$created_datetime'] && r['$created_datetime'].value) return r['$created_datetime'].value;
                return '';
            };
            // ソート
            const sorted = records.sort((a, b) => {
                const tA = getTime(a);
                const tB = getTime(b);
                if (tA !== tB) {
                    return tA < tB ? -1 : 1;
                }
                // 日時が同じ(または秒単位まで同じ)場合はレコードID($id)で比較して登録順を保証
                const idA = Number(a.$id.value);
                const idB = Number(b.$id.value);
                return idA < idB ? -1 : 1;
            });
            let lastDateStr = '';
            sorted.forEach(r => {
                try {
                    const timeVal = getTime(r);
                    const content = (r[fieldMap.MESSAGE_CONTENT] || {}).value || '';
                    const direction = forceBot ? CONFIG.DIRECTION_VALUES.BOT : ((r[fieldMap.DIRECTION] || {}).value || '');
                    const attachments = (r[fieldMap.ATTACHMENT] || {}).value || [];
                    const dateObj = new Date(timeVal);
                    const dateStr = dateObj.toLocaleDateString('ja-JP');
                    if (dateStr !== lastDateStr && !isNaN(dateObj.getTime())) {
                        const divider = document.createElement('div');
                        divider.classList.add('chat-date-divider');
                        const label = document.createElement('div');
                        label.classList.add('chat-date-label');
                        label.innerText = dateObj.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', weekday: 'short' });
                        divider.appendChild(label);
                        listDiv.appendChild(divider);
                        lastDateStr = dateStr;
                    }
                    const isUser = (direction === CONFIG.DIRECTION_VALUES.USER);
                    const row = document.createElement('div');
                    row.classList.add('chat-row', isUser ? 'chat-row-left' : 'chat-row-right');
                    const msgRow = document.createElement('div');
                    msgRow.classList.add('chat-message-row');
                    const bubble = document.createElement('div');
                    bubble.classList.add('chat-bubble', isUser ? 'chat-bubble-white' : 'chat-bubble-green');
                    // 1. 画像URL (298) がある場合
                    const urlVal = (fieldMap.URL && r[fieldMap.URL]) ? r[fieldMap.URL].value : '';
                    if (urlVal) {
                        const img = document.createElement('img');
                        img.src = urlVal;
                        img.classList.add('chat-image-content');
                        img.onclick = () => window.open(urlVal, '_blank');
                        bubble.appendChild(img);
                    }
                    // 2. 添付ファイル（画像）があれば表示 (URLがない場合のみ)
                    else if (attachments.length > 0) {
                        attachments.forEach(file => {
                            const img = document.createElement('img');
                            img.classList.add('chat-image-content');
                            fetchImage(file.fileKey, img, file.name);
                            bubble.appendChild(img);
                        });
                    }
                    // 2. [Image] 外部リンクパターンがあれば表示
                    const imageMatch = content.match(/^\[Image\]\s+(https?:\/\/\S+)/i);
                    if (imageMatch) {
                        const img = document.createElement('img');
                        img.src = imageMatch[1];
                        img.classList.add('chat-image-content');
                        img.onclick = () => window.open(imageMatch[1], '_blank');
                        bubble.appendChild(img);
                    }
                    // 3. テキスト本文を後に表示
                    const displayText = imageMatch ? content.replace(imageMatch[0], '').trim() : content;
                    if (displayText) {
                        const textWrapper = document.createElement('div');
                        textWrapper.innerText = displayText;
                        // すでに画像がある場合は上にマージンを作る
                        if (bubble.hasChildNodes()) {
                            textWrapper.style.marginTop = '8px';
                        }
                        bubble.appendChild(textWrapper);
                    }
                    const timeLabel = document.createElement('div');
                    timeLabel.classList.add('chat-time-label');
                    timeLabel.innerText = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                    // 欄外情報 (サイクル・ステータス)
                    const metaArea = document.createElement('div');
                    metaArea.classList.add('chat-meta-area');
                    metaArea.appendChild(timeLabel);
                    if (fieldMap.CYCLE && fieldMap.STATUS) {
                        const cycleVal = (r[fieldMap.CYCLE] || {}).value || '';
                        const statusVal = (r[fieldMap.STATUS] || {}).value || '';
                        if (cycleVal) {
                            const tag = document.createElement('div');
                            tag.classList.add('chat-tag-cycle');
                            tag.innerText = cycleVal;
                            metaArea.appendChild(tag);
                        }
                        if (statusVal) {
                            const badge = document.createElement('div');
                            badge.classList.add('chat-status-badge', 'status-' + statusVal);
                            badge.innerText = statusVal;
                            metaArea.appendChild(badge);
                        }
                    }
                    if (isUser) {
                        msgRow.appendChild(bubble);
                        msgRow.appendChild(metaArea);
                    } else {
                        // アプリ300（定期配信）の場合は編集ボタンを追加
                        if (fieldMap.CYCLE) {
                            const editWrapper = document.createElement('div');
                            editWrapper.classList.add('chat-edit-wrapper');
                            const editBtn = document.createElement('button');
                            editBtn.classList.add('chat-edit-btn');
                            editBtn.innerText = '編集';
                            editBtn.onclick = () => {
                                // フォームにデータをセット
                                editingRecordId = r.$id.value;
                                editorElements300.textarea.value = content;
                                editorElements300.dateInput.value = (r[fieldMap.DELIVERY_DATE] || {}).value || '';
                                editorElements300.cycleInput.value = (r[fieldMap.CYCLE] || {}).value || '1回のみ';
                                editorElements300.statusInput.value = (r[fieldMap.STATUS] || {}).value || '配信待ち';
                                // 添付ファイルの状態表示
                                editorElements300.fileInput.value = '';
                                if (attachments.length > 0) {
                                    editorElements300.fileInfo.innerText = '📎 現在の画像を維持（変更する場合のみ選択）';
                                    editorElements300.fileInfo.style.display = 'block';
                                } else {
                                    editorElements300.fileInfo.style.display = 'none';
                                }
                                // UI切り替え
                                editorElements300.inputArea.classList.add('editing');
                                editorElements300.sendBtn.innerText = '更新内容で保存';
                                editorElements300.cancelBtn.style.display = 'inline-block';
                                editorElements300.textarea.focus();
                                editorElements300.inputArea.scrollIntoView({ behavior: 'smooth' });
                            };
                            editWrapper.appendChild(metaArea);
                            editWrapper.appendChild(editBtn);
                            msgRow.appendChild(editWrapper);
                        } else {
                            msgRow.appendChild(metaArea);
                        }
                        msgRow.appendChild(bubble);
                    }
                    row.appendChild(msgRow);
                    listDiv.appendChild(row);
                } catch (recErr) {
                    console.error('Record Render Error:', recErr, r);
                }
            });
            listDiv.scrollTop = listDiv.scrollHeight;
        } catch (err) {
            console.error('renderMessageList Critical Error:', err);
            listDiv.innerText = '表示エラーが発生しました';
        }
    }
    /**
     * 画像取得
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
                imgElement.onclick = () => {
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = fileName || 'download.png';
                    a.click();
                };
            }
        };
        xhr.send();
    }
    /**
     * 汎用レコード取得 (全件)
     */
    function fetchRecords(appId, query, opt_offset, opt_records) {
        const offset = opt_offset || 0;
        const allRecords = opt_records || [];
        const limit = 500;
        const fullQuery = `${query} limit ${limit} offset ${offset}`;
        return kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
            app: appId,
            query: fullQuery
        }).then(resp => {
            const records = resp.records;
            const updated = allRecords.concat(records);
            if (records.length === limit) {
                return fetchRecords(appId, query, offset + limit, updated);
            }
            return updated;
        });
    }
})();
