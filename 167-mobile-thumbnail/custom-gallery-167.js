(function () {
    'use strict';

    var events = [
        'app.record.index.show',
        'mobile.app.record.index.show'
    ];

    kintone.events.on(events, function (event) {
        var container = document.getElementById('custom-gallery-container');
        if (!container) return event;

        container.innerHTML = '';
        container.style.padding = '15px';
        container.style.backgroundColor = '#fff';
        container.style.fontFamily = 'sans-serif';

        // --- 現在の検索条件（URLのquery）から選択状態を取得して復元 ---
        var condition = kintone.app.getQueryCondition() || '';
        var initialDeptCode = '';
        var initialCauseCode = '';
        var initialContent = '';

        // queryの文字列から現在選ばれている課コードや原因分類コードを抽出する
        var mDept = condition.match(/返品後_課コード\s*=\s*"?([^"\s]+)"?/);
        if (mDept) initialDeptCode = mDept[1];

        var mCause1 = condition.match(/返品後_要因分類コード\s*=\s*"?([^"\s]+)"?/);
        var mCause2 = condition.match(/要因分類コード\s*=\s*"?([^"\s]+)"?/);
        if (mCause1) initialCauseCode = mCause1[1];
        else if (mCause2) initialCauseCode = mCause2[1];

        var mContent = condition.match(/不適合内容\s*(?:=|in)\s*(?:\(?\s*"([^"]+)"\s*\)?)/);
        if (mContent) initialContent = mContent[1];

        // --- ドロップダウンUI（マスタ・フォーム全件表示対応版）を作成 ---
        var filterArea = document.createElement('div');
        filterArea.style.display = 'flex';
        filterArea.style.flexWrap = 'wrap';
        filterArea.style.gap = '10px';
        filterArea.style.marginBottom = '20px';
        filterArea.style.padding = '15px';
        filterArea.style.backgroundColor = '#f4f5f9';
        filterArea.style.borderRadius = '8px';
        filterArea.style.border = '1px solid #d3d5d9';
        filterArea.style.alignItems = 'center';

        var selDept = document.createElement('select');
        var selCause = document.createElement('select');
        var selContent = document.createElement('select');
        var searchBtn = document.createElement('button');

        function setupSelectStyle(sel, defaultLabel) {
            sel.style.padding = '8px 12px';
            sel.style.borderRadius = '4px';
            sel.style.border = '1px solid #ccc';
            sel.style.fontSize = '14px';
            sel.style.maxWidth = '100%';
            sel.innerHTML = '<option value="">' + defaultLabel + '</option>';
            return sel;
        }

        setupSelectStyle(selDept, 'すべての課 (読込中...)');
        setupSelectStyle(selCause, 'すべての原因分類 (読込中...)');
        setupSelectStyle(selContent, 'すべての不適合内容 (読込中...)');

        // 検索ボタン
        searchBtn.innerText = '検索して絞り込む';
        searchBtn.style.padding = '8px 24px';
        searchBtn.style.backgroundColor = '#3498db';
        searchBtn.style.color = '#fff';
        searchBtn.style.border = 'none';
        searchBtn.style.borderRadius = '4px';
        searchBtn.style.cursor = 'pointer';
        searchBtn.style.fontWeight = 'bold';
        searchBtn.style.fontSize = '14px';
        searchBtn.onclick = function () {
            var q = [];

            // フィールドコードが環境によって揺れる場合を考慮してクエリを作成（数値型の比較）
            if (selDept.value) q.push('返品後_課コード = "' + selDept.value + '"');
            if (selCause.value) {
                // アプリの構成上、返品後_要因分類コードが基本となる
                q.push('返品後_要因分類コード = "' + selCause.value + '"');
            }
            if (selContent.value) q.push('不適合内容 in ("' + selContent.value + '")');

            var url = window.location.pathname + '?view=' + event.viewId;
            if (q.length > 0) {
                url += '&query=' + encodeURIComponent(q.join(' and '));
            }
            window.location.href = url; // 画面遷移してKintoneの検索を発動

            searchBtn.innerText = '検索中...';
            searchBtn.disabled = true;
            searchBtn.style.backgroundColor = '#999';
        };

        filterArea.appendChild(selDept);
        filterArea.appendChild(selCause);
        filterArea.appendChild(selContent);
        filterArea.appendChild(searchBtn);
        container.appendChild(filterArea);

        // --- マスタデータ（課と原因）およびフォーム情報（不適合内容）の取得準備 ---
        var deptMap = {};   // 課コード -> 課名
        var causeMap = {};  // 原因分類コード -> 原因分類名

        // 1. 課マスタ（アプリID:92）の取得
        var xhrApp92 = new XMLHttpRequest();
        xhrApp92.open('GET', '/k/v1/records.json?app=92&query=' + encodeURIComponent('利用区分 in ("利用する") order by 順 asc'), true);
        xhrApp92.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhrApp92.setRequestHeader('X-Cybozu-API-Token', 'grt3LJb0VeSMDIUmvoraZVswynPHx1q67uBmnZoR');
        xhrApp92.onload = function () {
            selDept.innerHTML = '<option value="">すべての課</option>';
            if (xhrApp92.status === 200) {
                var res = JSON.parse(xhrApp92.responseText);
                res.records.forEach(function (r) {
                    var code = r['課コード'].value;
                    var name = r['課名'].value;
                    deptMap[code] = name;

                    var opt = document.createElement('option');
                    opt.value = code; // プルダウンのValueはコードとする
                    opt.innerText = name; // 表示ラベルは課名とする
                    selDept.appendChild(opt);
                });
                if (initialDeptCode) selDept.value = initialDeptCode;
            } else {
                selDept.innerHTML = '<option value="">(読込失敗)</option>';
            }
            // マスタ取得が終わったら画面描画（少しチカチカするのを防ぐため非同期後）
            renderGalleryIfReady();
        };

        // 2. 原因分類マスタ（アプリID:168）の取得
        // ※原因分類の画面用APIトークンが不明なため、kintone.apiを利用して同一ユーザーセッションで取得します。
        // もし権限がない場合はトークンが必要になりますが、一般的にマスタは閲覧可能とします。
        kintone.api(kintone.api.url('/k/v1/records', true), 'GET', { app: 168, query: 'order by 原因分類コード asc' }).then(function (resp) {
            selCause.innerHTML = '<option value="">すべての原因分類</option>';
            resp.records.forEach(function (r) {
                var code = r['原因分類コード'] ? r['原因分類コード'].value : '';
                var name = r['原因分類'] ? r['原因分類'].value : '';
                if (code && name) {
                    causeMap[code] = name;
                    var opt = document.createElement('option');
                    opt.value = code;
                    opt.innerText = name;
                    selCause.appendChild(opt);
                }
            });
            if (initialCauseCode) selCause.value = initialCauseCode;

            renderGalleryIfReady();
        }).catch(function (err) {
            console.error('原因分類マスタの取得に失敗しました', err);
            selCause.innerHTML = '<option value="">(原因分類読込失敗)</option>';
            renderGalleryIfReady(); // エラー時は名前が解決できなくても描画を進める
        });

        // 3. 自アプリのフォーム情報（不適合内容ドロップダウン選択肢）の取得
        var currentAppId = kintone.app.getId();
        if (!currentAppId && kintone.mobile && kintone.mobile.app) {
            currentAppId = kintone.mobile.app.getId();
        }
        kintone.api(kintone.api.url('/k/v1/app/form/fields', true), 'GET', { app: currentAppId }).then(function (resp) {
            var contentOptions = resp.properties['不適合内容'].options;
            var sortedContent = Object.keys(contentOptions).sort(function (a, b) { return contentOptions[a].index - contentOptions[b].index; });
            selContent.innerHTML = '<option value="">すべての不適合内容</option>';
            sortedContent.forEach(function (o) {
                var opt = document.createElement('option');
                opt.value = o; opt.innerText = o;
                selContent.appendChild(opt);
            });
            if (initialContent) selContent.value = initialContent;
        }).catch(function (err) {
            selContent.innerHTML = '<option value="">(不適合内容読込失敗)</option>';
        });

        xhrApp92.send();

        // --- 画像描画エリアの準備 ---
        var galleryArea = document.createElement('div');
        container.appendChild(galleryArea);

        var records = event.records;
        var renderStatus = 0;

        function renderGalleryIfReady() {
            renderStatus++;
            // 課マスタと原因マスタの両方が返ってきたら描画を開始する（2つ）
            if (renderStatus < 2) return;

            galleryArea.innerHTML = ''; // 過去の描画があればクリア

            if (!records || records.length === 0) {
                galleryArea.innerHTML = '<div style="padding: 20px; color:#666; font-size:16px;">この検索条件に一致する画像データはありません。<br>上のプルダウンを変更して「検索して絞り込む」を押してください。</div>';
                return;
            }

            // データを「課名 ＞ 原因分類名 ＞ 不適合内容」の3階層でグループ化
            var grouped = {};
            records.forEach(function (record) {
                // コードを取り出す
                var deptCodeRaw = record['返品後_課コード'] ? record['返品後_課コード'].value : '';
                var causeCodeRaw = record['返品後_要因分類コード'] ? record['返品後_要因分類コード'].value : (record['要因分類コード'] ? record['要因分類コード'].value : '');

                // マスタから名前を解決（マスタにない場合はコードをそのまま表示して警告）
                var kName = deptCodeRaw ? (deptMap[deptCodeRaw] || '（不明な課:' + deptCodeRaw + '）') : '（課未入力）';
                var causeName = causeCodeRaw ? (causeMap[causeCodeRaw] || '（不明な原因:' + causeCodeRaw + '）') : '（原因分類未入力）';
                var contentName = record['不適合内容'] && record['不適合内容'].value ? record['不適合内容'].value : '（不適合内容 未入力）';

                // 2つの画像フィールド（部位・全体）の画像を1つの配列に結合する
                var images1 = record['不適合内容画像_部位'] && record['不適合内容画像_部位'].value ? record['不適合内容画像_部位'].value : [];
                var images2 = record['不適合内容画像_全体'] && record['不適合内容画像_全体'].value ? record['不適合内容画像_全体'].value : [];
                var images = images1.concat(images2);

                var recId = record['$id'] ? record['$id'].value : '';

                if (images.length === 0) return; // 画像がないレコードは画面領域を作らない

                if (!grouped[kName]) grouped[kName] = {};
                if (!grouped[kName][causeName]) grouped[kName][causeName] = {};
                if (!grouped[kName][causeName][contentName]) grouped[kName][causeName][contentName] = [];

                images.forEach(function (img) {
                    img.recordId = recId;
                    grouped[kName][causeName][contentName].push(img);
                });
            });

            // 遅延読み込みObserver
            var lazyImageObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        var containerEl = entry.target;
                        var fileKey = containerEl.dataset.fileKey;
                        var recId = containerEl.dataset.recordId;

                        if (fileKey) {
                            containerEl.dataset.fileKey = '';
                            containerEl.innerHTML = '<div style="font-size:10px; color:#999; margin-top:35px; text-align:center;">読込中...</div>';

                            var apiUri = kintone.api.url('/k/v1/file.json', true) + '?fileKey=' + fileKey;
                            var xhr = new XMLHttpRequest();
                            xhr.open('GET', apiUri, true);
                            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                            xhr.responseType = 'blob';

                            xhr.onload = function () {
                                if (xhr.status === 200) {
                                    var blobUrl = window.URL.createObjectURL(xhr.response);
                                    var tempImg = new Image();
                                    tempImg.onload = function () {
                                        var canvas = document.createElement('canvas');
                                        var ctx = canvas.getContext('2d');
                                        var ratio = Math.min(200 / tempImg.width, 200 / tempImg.height);
                                        canvas.width = tempImg.width * ratio;
                                        canvas.height = tempImg.height * ratio;
                                        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
                                        var thumbDataUrl = canvas.toDataURL('image/jpeg', 0.8);

                                        var finalImg = document.createElement('img');
                                        finalImg.style.width = '100px';
                                        finalImg.style.height = '100px';
                                        finalImg.style.objectFit = 'cover';
                                        finalImg.style.borderRadius = '8px';
                                        finalImg.src = thumbDataUrl;

                                        containerEl.innerHTML = '';
                                        containerEl.appendChild(finalImg);

                                        containerEl.onclick = function () {
                                            var overlay = document.createElement('div');
                                            overlay.style.position = 'fixed';
                                            overlay.style.top = '0';
                                            overlay.style.left = '0';
                                            overlay.style.width = '100vw';
                                            overlay.style.height = '100vh';
                                            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                                            overlay.style.zIndex = '999999';
                                            overlay.style.display = 'flex';
                                            overlay.style.flexDirection = 'column';
                                            overlay.style.justifyContent = 'center';
                                            overlay.style.alignItems = 'center';

                                            var largeImg = document.createElement('img');
                                            largeImg.src = blobUrl;
                                            largeImg.style.maxWidth = '95%';
                                            largeImg.style.maxHeight = '75%';
                                            largeImg.style.objectFit = 'contain';
                                            largeImg.style.borderRadius = '8px';
                                            largeImg.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';

                                            var btnArea = document.createElement('div');
                                            btnArea.style.display = 'flex';
                                            btnArea.style.gap = '20px';
                                            btnArea.style.marginTop = '20px';

                                            var linkBtn = document.createElement('div');
                                            linkBtn.innerText = '📝 レコードを開く';
                                            linkBtn.style.color = '#fff';
                                            linkBtn.style.fontSize = '16px';
                                            linkBtn.style.fontWeight = 'bold';
                                            linkBtn.style.padding = '12px 24px';
                                            linkBtn.style.backgroundColor = '#3498db';
                                            linkBtn.style.borderRadius = '30px';
                                            linkBtn.style.border = '2px solid #2980b9';
                                            linkBtn.style.cursor = 'pointer';
                                            linkBtn.onclick = function (e) {
                                                e.stopPropagation();
                                                var isMobile = (window.location.pathname.indexOf('/m/') !== -1);
                                                var recObjUrl = '';
                                                if (isMobile) {
                                                    recObjUrl = '/k/m/' + currentAppId + '/show?record=' + recId;
                                                } else {
                                                    recObjUrl = '/k/' + currentAppId + '/show#record=' + recId;
                                                }
                                                window.location.href = recObjUrl;
                                            };

                                            var closeBtn = document.createElement('div');
                                            closeBtn.innerText = '× 閉じる';
                                            closeBtn.style.color = '#fff';
                                            closeBtn.style.fontSize = '16px';
                                            closeBtn.style.fontWeight = 'bold';
                                            closeBtn.style.padding = '12px 24px';
                                            closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                                            closeBtn.style.borderRadius = '30px';
                                            closeBtn.style.border = '1px solid rgba(255,255,255,0.4)';
                                            closeBtn.style.cursor = 'pointer';

                                            btnArea.appendChild(linkBtn);
                                            btnArea.appendChild(closeBtn);

                                            overlay.appendChild(largeImg);
                                            overlay.appendChild(btnArea);

                                            overlay.onclick = function () {
                                                if (document.body.contains(overlay)) {
                                                    document.body.removeChild(overlay);
                                                }
                                            };
                                            document.body.appendChild(overlay);
                                        };
                                    };
                                    tempImg.src = blobUrl;
                                } else {
                                    containerEl.innerHTML = '<div style="font-size:10px; color:red; margin-top:35px; text-align:center;">エラー</div>';
                                }
                            };
                            xhr.send();
                            observer.unobserve(containerEl);
                        }
                    }
                });
            }, { rootMargin: '100px 0px' });

            // 3階層のループで描画
            for (var kName in grouped) {
                var deptContainer = document.createElement('div');
                deptContainer.style.marginBottom = '30px';

                var kNameEl = document.createElement('div');
                kNameEl.style.fontSize = '22px';
                kNameEl.style.fontWeight = 'bold';
                kNameEl.style.color = '#111';
                kNameEl.style.borderBottom = '3px solid #333';
                kNameEl.style.paddingBottom = '5px';
                kNameEl.innerText = '[' + kName + ']';
                deptContainer.appendChild(kNameEl);

                for (var causeName in grouped[kName]) {
                    var causeContainer = document.createElement('div');
                    causeContainer.style.marginLeft = '10px';

                    var causeEl = document.createElement('div');
                    causeEl.style.fontSize = '18px';
                    causeEl.style.fontWeight = 'bold';
                    causeEl.style.color = '#444';
                    causeEl.style.marginTop = '20px';
                    causeEl.style.marginBottom = '8px';
                    causeEl.style.borderLeft = '5px solid #666';
                    causeEl.style.paddingLeft = '10px';
                    causeEl.innerText = '[' + causeName + ']';
                    causeContainer.appendChild(causeEl);

                    for (var contentName in grouped[kName][causeName]) {
                        var itemsArray = grouped[kName][causeName][contentName];

                        var contentEl = document.createElement('div');
                        contentEl.style.fontSize = '16px';
                        contentEl.style.fontWeight = 'bold';
                        contentEl.style.color = '#0052cc';
                        contentEl.style.marginTop = '15px';
                        contentEl.style.marginBottom = '8px';
                        contentEl.style.marginLeft = '10px';
                        contentEl.innerText = '[' + contentName + ']';
                        causeContainer.appendChild(contentEl);

                        var imgArea = document.createElement('div');
                        imgArea.style.display = 'flex';
                        imgArea.style.flexWrap = 'wrap';
                        imgArea.style.gap = '8px';
                        imgArea.style.marginLeft = '10px';
                        imgArea.style.marginBottom = '15px';

                        itemsArray.forEach(function (imgInfo) {
                            var imgBox = document.createElement('div');
                            imgBox.style.width = '100px';
                            imgBox.style.height = '100px';
                            imgBox.style.borderRadius = '8px';
                            imgBox.style.border = '1px solid #ddd';
                            imgBox.style.backgroundColor = '#f4f4f4';
                            imgBox.style.cursor = 'pointer';
                            imgBox.style.overflow = 'hidden';

                            imgBox.dataset.fileKey = imgInfo.fileKey;
                            imgBox.dataset.recordId = imgInfo.recordId;
                            lazyImageObserver.observe(imgBox);

                            imgArea.appendChild(imgBox);
                        });
                        causeContainer.appendChild(imgArea);
                    }
                    deptContainer.appendChild(causeContainer);
                }
                galleryArea.appendChild(deptContainer);
            }
        } // end of renderGalleryIfReady

        return event;
    });

})();
