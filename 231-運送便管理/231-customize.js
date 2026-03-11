(function () {
    'use strict';

    // 231-運送便管理
    const APP_231_ID = kintone.app.getId();
    const APP_227_ID = '227';

    // 一覧画面表示イベント
    kintone.events.on('app.record.index.show', function (event) {
        // 1. 不足分を追加するボタン (左側)
        if (!document.getElementById('sync_missing_button')) {
            const syncBtn = document.createElement('button');
            syncBtn.id = 'sync_missing_button';
            syncBtn.innerHTML = '➕ 不足分を追加';
            syncBtn.className = 'kintoneplugin-button-dialog-ok';
            syncBtn.style.margin = '0 10px';
            syncBtn.style.backgroundColor = '#2eb45e'; // 緑色
            syncBtn.onclick = async function () {
                if (!confirm('App 227(出荷管理)にあって、ここ(App 231)にない日付のレコードを追加しますか？')) return;

                try {
                    // 1. App 231の既存レコード(出荷日)を全取得
                    console.log('Fetching existing records from App 231...');
                    const existingSet = new Set();
                    let params = {
                        app: APP_231_ID,
                        fields: ['出荷日'],
                        query: 'limit 500'
                    };

                    let offset = 0;
                    while (true) {
                        params.query = `limit 500 offset ${offset}`;
                        const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', params);
                        if (resp.records.length === 0) break;

                        resp.records.forEach(r => {
                            const d = r['出荷日'].value;
                            if (d) existingSet.add(d);
                        });

                        offset += 500;
                        if (resp.records.length < 500) break;
                    }
                    console.log('Existing dates count:', existingSet.size);

                    // 2. App 227から全レコードを取得（条件なし）
                    console.log('Fetching source records from App 227...');

                    // 全件取得ループ
                    let records227 = [];
                    let offset227 = 0;
                    while (true) {
                        // 条件なし、全件取得
                        const q = `limit 500 offset ${offset227}`;
                        const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                            app: APP_227_ID,
                            query: q,
                            fields: ['出荷日']
                        });
                        records227 = records227.concat(resp.records);
                        if (resp.records.length < 500) break;
                        offset227 += 500;
                    }
                    console.log('Source App 227 records count:', records227.length);

                    // 3. 不足分を特定
                    const recordsToAdd = [];
                    const addingSet = new Set();

                    records227.forEach(r => {
                        const d = r['出荷日'].value;
                        if (!d) return; // 日付がないものは無視

                        // App 231に存在せず、かつ今回まだ追加リストに入れていない日付
                        if (!existingSet.has(d) && !addingSet.has(d)) {
                            recordsToAdd.push({
                                '出荷日': { value: d }
                            });
                            addingSet.add(d);
                        }
                    });

                    if (recordsToAdd.length === 0) {
                        alert('追加すべき不足レコード（日付）はありませんでした。');
                        return;
                    }

                    if (!confirm(`${recordsToAdd.length} 件の不足日付が見つかりました。追加しますか？`)) return;

                    // 4. 追加実行 (一括POST)
                    let successCount = 0;
                    for (let i = 0; i < recordsToAdd.length; i += 100) {
                        const chunk = recordsToAdd.slice(i, i + 100);
                        await kintone.api(kintone.api.url('/k/v1/records', true), 'POST', {
                            app: APP_231_ID,
                            records: chunk
                        });
                        successCount += chunk.length;
                    }

                    alert(`✅ ${successCount} 件のレコードを追加しました。`);
                    location.reload();

                } catch (err) {
                    console.error(err);
                    let errMsg = err.message || '不明なエラー';
                    if (err.errors) {
                        errMsg += '\n詳細: ' + JSON.stringify(err.errors);
                    }
                    alert('エラーが発生しました: ' + errMsg);
                }
            };
            kintone.app.getHeaderMenuSpaceElement().appendChild(syncBtn);
        }

        // 2. 一括再集計ボタン (右側)
        if (!document.getElementById('aggregate_all_button')) {
            const btn = document.createElement('button');
            btn.id = 'aggregate_all_button';
            btn.innerHTML = '🔄 一括再集計';
            btn.className = 'kintoneplugin-button-normal';
            btn.style.margin = '0 10px';
            btn.style.backgroundColor = '#64748b'; // 少し濃いグレー
            btn.style.color = 'white';
            btn.onclick = async function () {
                if (!confirm('表示されているレコードの集計結果を227-出荷管理から再取得して更新しますか？')) return;

                const records = event.records;
                if (records.length === 0) return;

                console.log('🚀 一括集計開始: ', records.length, '件');

                try {
                    const updateParams = [];
                    const cache = {};

                    for (const rec of records) {
                        const date = rec['出荷日'] ? rec['出荷日'].value : '';

                        if (!date) {
                            console.log('Skipping record (missing date):', rec.$id.value);
                            continue;
                        }

                        const cacheKey = `${date}`;
                        let summary;
                        if (cache[cacheKey]) {
                            summary = cache[cacheKey];
                        } else {
                            console.log('Fetching summary for:', cacheKey);
                            summary = await fetchSummaryFrom227(date);
                            cache[cacheKey] = summary;
                        }

                        if (summary) {
                            const updateRecord = {
                                // 新仕様のフィールドへ保存
                                '冨士才数_集計': { value: summary.FUJI_VOLUME || "" },
                                'オリジン才数_集計': { value: summary.ORIGIN_VOLUME || "" },
                                '合計才数_集計': { value: summary.TOTAL_VOLUME || "" }

                                // 旧仕様（コメントアウト）
                                // '冨士_個数': { value: summary.FUJI_COUNT || "" },
                                // '冨士_才数': { value: summary.FUJI_VOLUME || "" },
                            };

                            updateParams.push({
                                id: rec.$id.value,
                                record: updateRecord
                            });
                        }
                    }

                    if (updateParams.length > 0) {
                        console.log('Updating records:', updateParams);
                        await kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', {
                            app: APP_231_ID,
                            records: updateParams
                        });
                        alert('✅ 一括更新が完了しました。');
                        location.reload();
                    } else {
                        alert('更新対象のレコードがありませんでした。（日付が未入力）');
                    }
                } catch (err) {
                    console.error('❌ Error during batch update:', err);
                    alert('❌ エラーが発生しました: ' + (err.message || JSON.stringify(err)));
                }
            };
            kintone.app.getHeaderMenuSpaceElement().appendChild(btn);
        }

        // 3. 期間指定CSV出力ボタン
        if (!document.getElementById('period_export_button')) {
            const btn = document.createElement('button');
            const BUTTON_ID = 'period_export_button';
            btn.id = BUTTON_ID;
            btn.innerHTML = '📊 期間指定CSV出力';
            btn.className = 'kintoneplugin-button-normal';
            btn.style.margin = '0 10px';
            btn.style.backgroundColor = '#0ea5e9'; // Blue
            btn.style.color = 'white';
            btn.onclick = async function () {
                // デフォルト日付（今月の1日～末日）
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

                const formatDate = (dt) => {
                    const y = dt.getFullYear();
                    const m = ('00' + (dt.getMonth() + 1)).slice(-2);
                    const d = ('00' + dt.getDate()).slice(-2);
                    return `${y}-${m}-${d}`;
                };

                const defaultStart = formatDate(firstDay);
                const defaultEnd = formatDate(lastDay);

                const startStr = prompt("抽出開始日を入力してください (YYYY-MM-DD)", defaultStart);
                if (!startStr) return; // キャンセル

                const endStr = prompt("抽出終了日を入力してください (YYYY-MM-DD)", defaultEnd);
                if (!endStr) return; // キャンセル

                console.log(`🚀 CSV出力開始: ${startStr} ～ ${endStr}`);

                try {
                    // クエリ作成 (App 231 から取得)
                    const queryBase = `出荷日 >= "${startStr}" and 出荷日 <= "${endStr}"`;
                    let allRecords = [];
                    let offset = 0;
                    const limit = 500;

                    // 全件取得ループ
                    while (true) {
                        const query = `${queryBase} limit ${limit} offset ${offset}`;
                        const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                            app: kintone.app.getId(), // App 231
                            query: query
                        });

                        allRecords = allRecords.concat(resp.records);
                        if (resp.records.length < limit) break;
                        offset += limit;
                    }

                    if (allRecords.length === 0) {
                        alert('指定された期間にレコードが見つかりませんでした。');
                        return;
                    }

                    // CSV作成
                    // ヘッダー定義
                    const headers = [
                        "レコード番号", "出荷日", "確定区分", "冨士コストダウン", "費用合計",
                        "冨士才数", "冨士金額", "冨士才単価",
                        "オリジン才数", "オリジン金額", "オリジン才単価",
                        "運送会社コード1", "運送会社名1", "配送区分1", "車種1", "費用1", "コストダウン1", "才数設定目安1", "冨士時刻1", "冨士(個数)1", "冨士(才数)1", "冨士金額1", "オリジン時刻1", "オリジン(個数)1", "オリジン(才数)1", "オリジン金額1",
                        "運送会社コード2", "運送会社名2", "配送区分2", "車種2", "費用2", "コストダウン2", "才数設定目安2", "冨士時刻2", "冨士(個数)2", "冨士(才数)2", "冨士金額2", "オリジン時刻2", "オリジン(個数)2", "オリジン(才数)2", "オリジン金額2", "オリジン(積載時画像)2", "オリジン(出荷明細画像)2",
                        "冨士才数(集計)", "オリジン才数(集計)", "合計才数(集計)",
                        "冨士才数(差)", "オリジン才数(差)", "合計才数(差)"
                    ];

                    const Quote = (str) => {
                        if (str === null || str === undefined) return '""';
                        return `"${String(str).replace(/"/g, '""')}"`;
                    };

                    const getValue = (rec, code) => {
                        if (!rec[code]) return '';
                        if (rec[code].type === 'FILE') {
                            // ファイル名のリストを返す
                            return rec[code].value.map(f => f.name).join('\n');
                        }
                        if (rec[code].type === 'USER_SELECT' || rec[code].type === 'ORGANIZATION_SELECT' || rec[code].type === 'GROUP_SELECT') {
                            return rec[code].value.map(item => item.name).join('\n');
                        }
                        return rec[code].value;
                    };

                    const csvRows = [headers.map(Quote).join(',')];

                    allRecords.forEach(r => {
                        const row = [
                            getValue(r, 'レコード番号'),
                            getValue(r, '出荷日'),
                            getValue(r, '確定区分'),
                            getValue(r, '冨士コストダウン'),
                            getValue(r, '費用合計'),
                            getValue(r, '冨士才数'),
                            getValue(r, '冨士金額'),
                            getValue(r, '冨士才単価'),
                            getValue(r, 'オリジン才数'),
                            getValue(r, 'オリジン金額'),
                            getValue(r, 'オリジン才単価'),
                            // 1
                            getValue(r, '運送会社コード1'),
                            getValue(r, '運送会社名1'),
                            getValue(r, '配送区分1'),
                            getValue(r, '車種1'),
                            getValue(r, '費用1'),
                            getValue(r, 'コストダウン1'),
                            getValue(r, '才数設定目安1'),
                            getValue(r, '冨士時刻1'),
                            getValue(r, '冨士_個数1'),
                            getValue(r, '冨士_才数1'),
                            getValue(r, '冨士金額1'),
                            getValue(r, 'オリジン時刻1'),
                            getValue(r, 'オリジン_個数1'),
                            getValue(r, 'オリジン_才数1'),
                            getValue(r, 'オリジン金額1'),
                            // 2
                            getValue(r, '運送会社コード2'),
                            getValue(r, '運送会社名2'),
                            getValue(r, '配送区分2'),
                            getValue(r, '車種2'),
                            getValue(r, '費用2'),
                            getValue(r, 'コストダウン2'),
                            getValue(r, '才数設定目安2'),
                            getValue(r, '冨士時刻2'),
                            getValue(r, '冨士_個数2'),
                            getValue(r, '冨士_才数2'),
                            getValue(r, '冨士金額2'),
                            getValue(r, 'オリジン時刻2'),
                            getValue(r, 'オリジン_個数2'),
                            getValue(r, 'オリジン_才数2'),
                            getValue(r, 'オリジン金額2'),
                            getValue(r, 'オリジン_積載時画像2'),
                            getValue(r, 'オリジン_出荷明細画像2'),
                            // 集計
                            getValue(r, '冨士才数_集計'),
                            getValue(r, 'オリジン才数_集計'),
                            getValue(r, '合計才数_集計'),
                            // 差
                            getValue(r, '冨士才数_差'),
                            getValue(r, 'オリジン才数_差'),
                            getValue(r, '合計才数_差')
                        ];
                        csvRows.push(row.map(Quote).join(','));
                    });

                    // ダウンロード
                    const csvContent = csvRows.join("\n");
                    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
                    const blob = new Blob([bom, csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Transport_Export_${startStr}_${endStr}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    alert(`✅ ${allRecords.length} 件のデータを出力しました。`);

                } catch (err) {
                    console.error('❌ Error during CSV export:', err);
                    alert('❌ エラーが発生しました: ' + (err.message || JSON.stringify(err)));
                }
            };
            kintone.app.getHeaderMenuSpaceElement().appendChild(btn);
        }
    });

    // 詳細・編集画面表示イベント
    kintone.events.on(['app.record.detail.show', 'app.record.edit.show'], function (event) {
        if (document.getElementById('aggregate_single_button')) return;

        const btn = document.createElement('button');
        btn.id = 'aggregate_single_button';
        btn.innerHTML = '🔄 レコード別集計';
        btn.className = 'kintoneplugin-button-normal';
        btn.style.margin = '10px';
        btn.style.backgroundColor = '#64748b'; // 少し濃いグレー
        btn.style.color = 'white';
        btn.onclick = async function () {
            const record = kintone.app.record.get().record;
            const date = record['出荷日'] ? record['出荷日'].value : '';

            if (!date) {
                alert('出荷日を入力してからボタンを押してください。');
                return;
            }

            console.log('🚀 単一集計開始:', date);
            try {
                const summary = await fetchSummaryFrom227(date);
                if (summary) {
                    const current = kintone.app.record.get();

                    current.record['冨士才数_集計'].value = summary.FUJI_VOLUME || "";
                    current.record['オリジン才数_集計'].value = summary.ORIGIN_VOLUME || "";
                    current.record['合計才数_集計'].value = summary.TOTAL_VOLUME || "";

                    // 旧フィールド
                    // current.record['冨士_個数'].value = summary.FUJI_COUNT || "";
                    // current.record['冨士_才数'].value = summary.FUJI_VOLUME || "";

                    kintone.app.record.set(current);
                    alert('✅ 集計結果を反映しました。（保存はされていません）');
                } else {
                    alert('集計データが見つかりませんでした。');
                }
            } catch (err) {
                console.error('❌ Error during single update:', err);
                alert('❌ エラーが発生しました。コンソールログを確認してください。');
            }
        };

        kintone.app.record.getHeaderMenuSpaceElement().appendChild(btn);
    });

    /**
     * App 227 からの集計取得（REST API）
     */
    async function fetchSummaryFrom227(shippingDate) {
        let baseQuery = `出荷日 = "${shippingDate}"`;
        // if (shippingLaneCode) {
        //     baseQuery += ` and 運送便コード = "${shippingLaneCode}"`;
        // }

        let allRecords = [];
        let offset = 0;
        const limit = 500;

        while (true) {
            const query = `${baseQuery} limit ${limit} offset ${offset}`;
            const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: APP_227_ID,
                query: query
            });

            const fetched = resp.records || [];
            allRecords = allRecords.concat(fetched);

            if (fetched.length < limit) break;
            offset += limit;
        }

        const summary = { FUJI_COUNT: 0, FUJI_VOLUME: 0, ORIGIN_COUNT: 0, ORIGIN_VOLUME: 0, TOTAL_VOLUME: 0 };

        allRecords.forEach(rec => {
            const arrangement = (rec['手配'] && rec['手配'].value) ? rec['手配'].value : "";
            // const quantity = Number((rec['数量'] && rec['数量'].value) || 0); // 件数重視のため数量は合算しない
            const volume = Number((rec['才数計'] && rec['才数計'].value) || 0);

            // 合計は常に加算
            summary.TOTAL_VOLUME += volume;

            if (arrangement.includes("冨士")) {
                summary.FUJI_COUNT++; // レコード数をカウント
                summary.FUJI_VOLUME += volume;
            } else if (arrangement.includes("オリジン") || arrangement.includes("ｵﾘｼﾞﾝ") || arrangement.includes("オリ")) {
                // "オリ" も条件に追加（リクエストにより明確化されることが多いが、今回は既存ロジック+α）
                summary.ORIGIN_COUNT++; // レコード数をカウント
                summary.ORIGIN_VOLUME += volume;
            }
        });

        summary.FUJI_VOLUME = Math.round(summary.FUJI_VOLUME * 1000) / 1000;
        summary.ORIGIN_VOLUME = Math.round(summary.ORIGIN_VOLUME * 1000) / 1000;
        summary.TOTAL_VOLUME = Math.round(summary.TOTAL_VOLUME * 1000) / 1000;

        return summary;
    }

})();
