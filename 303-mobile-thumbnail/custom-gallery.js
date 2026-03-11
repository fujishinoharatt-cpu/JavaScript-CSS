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
        var initialDept = '';
        var initialPhenom = '';
        var initialProcess = '';

        // Kintoneの「query=」の文字列から、どの課や現象が選ばれているかを抽出する
        var mDept = condition.match(/課名\s*=\s*"([^"]+)"/);
        if (mDept) initialDept = mDept[1];

        var mPhenom = condition.match(/現象\s*(?:=|in)\s*(?:\(?\s*"([^"]+)"\s*\)?)/);
        if (mPhenom) initialPhenom = mPhenom[1];

        var mProcess = condition.match(/工程部署\s*(?:=|in)\s*(?:\(?\s*"([^"]+)"\s*\)?)/);
        if (mProcess) initialProcess = mProcess[1];

        // --- ドロップダウンUI（マスタ全件表示対応版）を作成 ---
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
        var selPhenom = document.createElement('select');
        var selProcess = document.createElement('select');
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
        setupSelectStyle(selPhenom, 'すべての現象 (読込中...)');
        setupSelectStyle(selProcess, 'すべての工程 (読込中...)');

        // 検索ボタン（Kintone標準の絞り込み機能の代わりに使う）
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
            // 選ばれた値をもとに、Kintoneの強力なデータベース検索式を組み立てる
            if (selDept.value) q.push('課名 = "' + selDept.value + '"');
            if (selPhenom.value) q.push('現象 in ("' + selPhenom.value + '")');
            if (selProcess.value) q.push('工程部署 in ("' + selProcess.value + '")');

            var url = window.location.pathname + '?view=' + event.viewId;
            if (q.length > 0) {
                url += '&query=' + encodeURIComponent(q.join(' and '));
            }
            window.location.href = url; // 画面を遷移してKintoneの検索を発動

            searchBtn.innerText = '検索中...';
            searchBtn.disabled = true;
            searchBtn.style.backgroundColor = '#999';
        };

        filterArea.appendChild(selDept);
        filterArea.appendChild(selProcess);
        filterArea.appendChild(selPhenom);
        filterArea.appendChild(searchBtn);
        container.appendChild(filterArea);

        // --- APIからマスタ全件（課・現象・工程）を取得してドロップダウンに入れる ---

        // 1. 現象と工程は、このアプリの設定（フォーム項目）から選択肢を全件取得
        var appId = kintone.app.getId();
        if (!appId && kintone.mobile && kintone.mobile.app) {
            appId = kintone.mobile.app.getId();
        }
        kintone.api(kintone.api.url('/k/v1/app/form/fields', true), 'GET', { app: appId }).then(function (resp) {
            var phenomOptions = resp.properties['現象'].options;
            var processOptions = resp.properties['工程部署'].options;

            // index順（設定画面の並び順）でソート
            var sortedPhenom = Object.keys(phenomOptions).sort(function (a, b) { return phenomOptions[a].index - phenomOptions[b].index; });
            var sortedProcess = Object.keys(processOptions).sort(function (a, b) { return processOptions[a].index - processOptions[b].index; });

            selPhenom.innerHTML = '<option value="">すべての現象</option>';
            sortedPhenom.forEach(function (o) {
                var opt = document.createElement('option');
                opt.value = o; opt.innerText = o;
                selPhenom.appendChild(opt);
            });
            selPhenom.value = initialPhenom;

            selProcess.innerHTML = '<option value="">すべての工程</option>';
            sortedProcess.forEach(function (o) {
                var opt = document.createElement('option');
                opt.value = o; opt.innerText = o;
                selProcess.appendChild(opt);
            });
            selProcess.value = initialProcess;
        });

        // 2. 課マスタは「アプリID:92」からAPIで取得する（教わったAPIトークンを利用）
        var xhrApp92 = new XMLHttpRequest();
        xhrApp92.open('GET', '/k/v1/records.json?app=92&query=' + encodeURIComponent('利用区分 in ("利用する") order by 順 asc'), true);
        xhrApp92.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhrApp92.setRequestHeader('X-Cybozu-API-Token', 'grt3LJb0VeSMDIUmvoraZVswynPHx1q67uBmnZoR');
        xhrApp92.onload = function () {
            selDept.innerHTML = '<option value="">すべての課</option>';
            if (xhrApp92.status === 200) {
                var res = JSON.parse(xhrApp92.responseText);
                res.records.forEach(function (r) {
                    var o = r['課名'].value;
                    var opt = document.createElement('option');
                    opt.value = o; opt.innerText = o;
                    selDept.appendChild(opt);
                });
            } else {
                selDept.innerHTML = '<option value="">(読込失敗)</option>';
            }
            selDept.value = initialDept;
        };
        xhrApp92.send();


        // --- 画像描画エリアの準備とデータの描画 ---
        var galleryArea = document.createElement('div');
        container.appendChild(galleryArea);

        var records = event.records;
        if (!records || records.length === 0) {
            galleryArea.innerHTML = '<div style="padding: 20px; color:#666; font-size:16px;">この検索条件に一致する画像データはありません。<br>上のプルダウンを変更して「検索して絞り込む」を押してください。</div>';
            return event;
        }

        var grouped = {};
        records.forEach(function (record) {
            var kName = record['課名'] ? record['課名'].value : '（課未入力）';
            var phenom = record['現象'] ? record['現象'].value : '（現象未入力）';
            var process = record['工程部署'] ? record['工程部署'].value : '（工程未入力）';
            var images = record['不適合画像'] ? record['不適合画像'].value : [];
            var recId = record['$id'] ? record['$id'].value : '';

            if (!grouped[kName]) grouped[kName] = {};
            if (!grouped[kName][phenom]) grouped[kName][phenom] = {};
            if (!grouped[kName][phenom][process]) grouped[kName][phenom][process] = [];

            if (images.length === 0) {
                // 画像がないレコードでもツリーには表示させ、画像枠の代わりに「画像なし」プレースホルダーを入れる
                grouped[kName][phenom][process].push({ isDummy: true, recordId: recId });
                return;
            }

            images.forEach(function (img) {
                // 画像データに元のレコードIDをプロパティとして持たせておく
                img.recordId = recId;
                grouped[kName][phenom][process].push(img);
            });
        });

        // 遅延読み込みObserver
        var lazyImageObserver = new IntersectionObserver(function (entries, observer) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var containerEl = entry.target;
                    var fileKey = containerEl.dataset.fileKey;

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
                                        var recId = containerEl.dataset.recordId;

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

                                        // ボタンを横並びにするエリア
                                        var btnArea = document.createElement('div');
                                        btnArea.style.display = 'flex';
                                        btnArea.style.gap = '20px';
                                        btnArea.style.marginTop = '20px';

                                        // レコードへ飛ぶボタン
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
                                            e.stopPropagation(); // 黒背景の「閉じる」処理が暴発しないように止める

                                            // スマホ版かPC版かを判定
                                            var isMobile = (window.location.pathname.indexOf('/m/') !== -1);

                                            // アプリIDを取得
                                            var currentAppId = kintone.app.getId();
                                            if (!currentAppId && kintone.mobile && kintone.mobile.app) {
                                                currentAppId = kintone.mobile.app.getId();
                                            }

                                            var recordUrl = '';
                                            if (isMobile) {
                                                // スマホ用（Kintoneモバイル版画面）のレコード詳細URL
                                                recordUrl = '/k/m/' + currentAppId + '/show?record=' + recId;
                                            } else {
                                                // PC用のレコード詳細URL
                                                recordUrl = '/k/' + currentAppId + '/show#record=' + recId;
                                            }

                                            window.location.href = recordUrl;
                                        };

                                        // 閉じるボタン
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

            for (var phenom in grouped[kName]) {
                var phenomContainer = document.createElement('div');
                phenomContainer.style.marginLeft = '10px';

                var phenomEl = document.createElement('div');
                phenomEl.style.fontSize = '18px';
                phenomEl.style.fontWeight = 'bold';
                phenomEl.style.color = '#444';
                phenomEl.style.marginTop = '20px';
                phenomEl.style.marginBottom = '8px';
                phenomEl.style.borderLeft = '5px solid #666';
                phenomEl.style.paddingLeft = '10px';
                phenomEl.innerText = '[' + phenom + ']';
                phenomContainer.appendChild(phenomEl);

                for (var process in grouped[kName][phenom]) {
                    var itemsArray = grouped[kName][phenom][process];

                    var procEl = document.createElement('div');
                    procEl.style.fontSize = '16px';
                    procEl.style.fontWeight = 'bold';
                    procEl.style.color = '#0052cc';
                    procEl.style.marginTop = '15px';
                    procEl.style.marginBottom = '8px';
                    procEl.style.marginLeft = '10px';
                    procEl.innerText = '[' + process + ']';
                    phenomContainer.appendChild(procEl);

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
                        imgBox.style.display = 'flex';
                        imgBox.style.alignItems = 'center';
                        imgBox.style.justifyContent = 'center';

                        if (imgInfo.isDummy) {
                            // 画像なしプレースホルダーの描画
                            imgBox.innerHTML = '<span style="color:#999;font-size:12px;">画像なし</span>';
                            imgBox.onclick = function () {
                                var isMobile = (window.location.pathname.indexOf('/m/') !== -1);
                                var currentAppId = kintone.app.getId();
                                if (!currentAppId && kintone.mobile && kintone.mobile.app) {
                                    currentAppId = kintone.mobile.app.getId();
                                }
                                var recObjUrl = isMobile ? '/k/m/' + currentAppId + '/show?record=' + imgInfo.recordId : '/k/' + currentAppId + '/show#record=' + imgInfo.recordId;
                                window.location.href = recObjUrl;
                            };
                        } else {
                            // 通常の画像遅延読み込みの設定
                            imgBox.dataset.fileKey = imgInfo.fileKey;
                            imgBox.dataset.recordId = imgInfo.recordId; // Observerで使えるようにレコードIDを渡す
                            lazyImageObserver.observe(imgBox);
                        }

                        imgArea.appendChild(imgBox);
                    });
                    phenomContainer.appendChild(imgArea);
                }
                deptContainer.appendChild(phenomContainer);
            }
            galleryArea.appendChild(deptContainer);
        }

        return event;
    });

})();
