/* bulk_delete_main.js */
(function() {
    'use strict';

    /**
     * Kintone 画面フィルター連動型 一括削除ツール (汎用)
     * 現在の一覧画面で設定されている「絞り込み条件（クエリ）」をそのまま削除対象にするツールです。
     */
    kintone.events.on('app.record.index.show', function(event) {
        if (document.getElementById('kintone_bulk_delete_btn')) return event;

        const config = window.kintoneBulkDeleteConfig || {};
        const btnLabel = config.buttonLabel || '🗑 絞り込み対象を全削除';
        
        const btn = document.createElement('button');
        btn.id = 'kintone_bulk_delete_btn';
        btn.innerText = btnLabel;
        btn.className = 'kintoneplugin-button-normal bulk-delete-btn';

        btn.onclick = async function() {
            const rawQuery = kintone.app.getQuery();
            const appId = kintone.app.getId();

            // クエリから既存の limit / offset を除去（これらが重複するとエラーになるため）
            const query = rawQuery
                .replace(/limit\s+\d+\s*/gi, '')
                .replace(/offset\s+\d+\s*/gi, '');

            try {
                // 1. レコード件数の事前確認
                const countResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                    app: appId,
                    query: query + ' limit 1',
                    totalCount: true
                });

                const total = parseInt(countResp.totalCount, 10);
                if (total === 0 || isNaN(total)) {
                    alert('削除対象のレコードが見つかりません。絞り込み条件を確認してください。\n\n【クエリ】: ' + query);
                    return;
                }

                // 2. 最終確認
                const msg = '⚠️【一括削除の実行】\n\n現在の絞り込み条件に一致する ' + total + ' 件のレコードをすべて削除します。よろしいですか？\n\n【条件】: ' + query;
                if (!confirm(msg)) return;

                // 3. 処理開始
                btn.disabled = true;
                btn.innerText = '準備中...';
                let deletedCount = 0;

                const processBatch = async () => {
                    // IDのみを100件取得
                    const fetchResp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                        app: appId,
                        query: query + ' limit 100',
                        fields: ['$id']
                    });

                    const records = fetchResp.records;
                    if (!records || records.length === 0) {
                        alert('✅ 完了\n合計 ' + deletedCount + ' 件を削除しました。');
                        location.reload();
                        return;
                    }

                    const ids = records.map(r => r.$id.value);

                    // 削除API実行
                    await kintone.api(kintone.api.url('/k/v1/records', true), 'DELETE', {
                        app: appId,
                        ids: ids
                    });

                    deletedCount += ids.length;
                    btn.innerText = '🗑 削除中 (' + deletedCount + ' / ' + total + ') ...';
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                    return processBatch();
                };

                await processBatch();

            } catch (err) {
                console.error('Bulk Delete Error:', err);
                let message = '不明なエラーが発生しました。';
                if (err.message) message = err.message;
                if (err.error && err.error.message) message = err.error.message;
                
                alert('❌ エラーが発生しました:\n' + message + '\n\n【デバッグ情報】クエリ: ' + query);
                btn.disabled = false;
                btn.innerText = btnLabel;
            }
        };

        // Kintoneヘッダーエリアにボタンを設置
        kintone.app.getHeaderMenuSpaceElement().appendChild(btn);
        return event;
    });
})();
