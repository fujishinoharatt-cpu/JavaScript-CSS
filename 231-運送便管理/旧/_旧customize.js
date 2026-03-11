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
            syncBtn.innerHTML = '📥 データin';
            syncBtn.className = 'kintoneplugin-button-dialog-ok';
            syncBtn.style.margin = '0 10px';
            syncBtn.style.backgroundColor = '#f97316'; // オレンジ色
            syncBtn.onclick = async function () {
                if (!confirm('App 227(出荷管理)にあって、ここ(App 231)にない「冨士ファニチア」のレコードを追加しますか？')) return;

                try {
                    // 1. App 231の既存レコード(出荷日+便コード)を全取得
                    console.log('Fetching existing records from App 231...');
                    const existingSet = new Set();
                    let params = {
                        app: APP_231_ID,
                        fields: ['出荷日', '運送便コード'],
                        query: 'limit 500'
                    };

                    let offset = 0;
                    while (true) {
                        params.query = `limit 500 offset ${offset}`;
                        const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', params);
                        if (resp.records.length === 0) break;

                        resp.records.forEach(r => {
                            const d = r['出荷日'].value;
                            const l = r['運送便コード'].value;
                            if (d && l) existingSet.add(`${d}_${l}`);
                        });

                        offset += 500;
                        if (resp.records.length < 500) break;
                    }
                    console.log('Existing records count:', existingSet.size);

                    // 2. App 227から「冨士ファニチア」のレコードを取得
                    console.log('Fetching source records from App 227...');

                    // 全件取得ループ
                    let records227 = [];
                    let offset227 = 0;
                    while (true) {
                        const q = `手配 in ("冨士ファニチア㈱") limit 500 offset ${offset227}`;
                        const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                            app: APP_227_ID,
                            query: q,
                            fields: ['出荷日', '運送便コード']
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
                        const l = r['運送便コード'].value;
                        if (!d || !l) return;

                        const key = `${d}_${l}`;
                        if (!existingSet.has(key) && !addingSet.has(key)) {
                            recordsToAdd.push({
                                '出荷日': { value: d },
                                '運送便コード': { value: l }
                            });
                            addingSet.add(key);
                        }
                    });

                    if (recordsToAdd.length === 0) {
                        alert('追加すべき不足レコードはありませんでした。');
                        return;
                    }

                    if (!confirm(`${recordsToAdd.length} 件の不足レコードが見つかりました。追加しますか？`)) return;

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
                    alert('エラーが発生しました: ' + err.message);
                }
            };
            kintone.app.getHeaderMenuSpaceElement().appendChild(syncBtn);
        }

        // 2. 一括再集計ボタン (右側)
        if (!document.getElementById('aggregate_all_button')) {
            const btn = document.createElement('button');
            btn.id = 'aggregate_all_button';
            btn.innerHTML = '🔄 一括再集計 (冨士)';
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
                        const laneCode = rec['運送便コード'] ? rec['運送便コード'].value : '';

                        if (!date || !laneCode) {
                            console.log('Skipping record (missing date or lane code):', rec.$id.value);
                            continue;
                        }

                        const cacheKey = `${date}_${laneCode}`;
                        let summary;
                        if (cache[cacheKey]) {
                            summary = cache[cacheKey];
                        } else {
                            console.log('Fetching summary for:', cacheKey);
                            summary = await fetchSummaryFrom227(date, laneCode);
                            cache[cacheKey] = summary;
                        }

                        if (summary) {
                            const updateRecord = {
                                '冨士_個数': { value: summary.FUJI_COUNT || "" },
                                '冨士_才数': { value: summary.FUJI_VOLUME || "" },
                                // 'オリジン_個数': { value: summary.ORIGIN_COUNT || "" },
                                // 'オリジン_才数': { value: summary.ORIGIN_VOLUME || "" }
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
                        alert('更新対象のレコードがありませんでした。（日付または運送便コードが未入力）');
                    }
                } catch (err) {
                    console.error('❌ Error during batch update:', err);
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
        btn.innerHTML = '🔄 レコード別集計(冨士)';
        btn.className = 'kintoneplugin-button-normal';
        btn.style.margin = '10px';
        btn.style.backgroundColor = '#64748b'; // 少し濃いグレー
        btn.style.color = 'white';
        btn.onclick = async function () {
            const record = kintone.app.record.get().record;
            const date = record['出荷日'] ? record['出荷日'].value : '';
            const laneCode = record['運送便コード'] ? record['運送便コード'].value : '';

            if (!date || !laneCode) {
                alert('出荷日と運送便コードを入力してからボタンを押してください。');
                return;
            }

            console.log('🚀 単一集計開始:', date, laneCode);
            try {
                const summary = await fetchSummaryFrom227(date, laneCode);
                if (summary) {
                    const current = kintone.app.record.get();

                    current.record['冨士_個数'].value = summary.FUJI_COUNT || "";
                    current.record['冨士_才数'].value = summary.FUJI_VOLUME || "";
                    // current.record['オリジン_個数'].value = summary.ORIGIN_COUNT || "";
                    // current.record['オリジン_才数'].value = summary.ORIGIN_VOLUME || "";

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
    async function fetchSummaryFrom227(shippingDate, shippingLaneCode) {
        let baseQuery = `出荷日 = "${shippingDate}"`;
        if (shippingLaneCode) {
            baseQuery += ` and 運送便コード = "${shippingLaneCode}"`;
        }

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

        const summary = { FUJI_COUNT: 0, FUJI_VOLUME: 0, ORIGIN_COUNT: 0, ORIGIN_VOLUME: 0 };

        allRecords.forEach(rec => {
            const arrangement = (rec['手配'] && rec['手配'].value) ? rec['手配'].value : "";
            // const quantity = Number((rec['数量'] && rec['数量'].value) || 0); // 件数重視のため数量は合算しない
            const volume = Number((rec['才数計'] && rec['才数計'].value) || 0);

            if (arrangement.includes("冨士")) {
                summary.FUJI_COUNT++; // レコード数をカウント
                summary.FUJI_VOLUME += volume;
            }
            /* 
            else if (arrangement.includes("オリジン") || arrangement.includes("ｵﾘｼﾞﾝ")) {
                summary.ORIGIN_COUNT++; // レコード数をカウント
                summary.ORIGIN_VOLUME += volume;
            }
            */
        });

        summary.FUJI_VOLUME = Math.round(summary.FUJI_VOLUME * 1000) / 1000;
        summary.ORIGIN_VOLUME = Math.round(summary.ORIGIN_VOLUME * 1000) / 1000;

        return summary;
    }

})();
