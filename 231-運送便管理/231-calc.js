(function() {
  'use strict';

  // 一覧表示時にボタンを設置
  kintone.events.on('app.record.index.show', function(event) {
    if (document.getElementById('recalc_button') !== null) return;

    const btn = document.createElement('button');
    btn.id = 'recalc_button';
    btn.innerHTML = '全レコード再計算';
    btn.className = 'kintone-ui-button-common'; // kintone標準風スタイル
    btn.onclick = function() {
      if (confirm('全レコードを再計算（空更新）しますか？')) {
        recalculateAllRecords(kintone.app.getId());
      }
    };
    kintone.app.getHeaderMenuSpaceElement().appendChild(btn);
  });

  async function recalculateAllRecords(appId) {
    // 処理中フラグ（二重押し防止など）
    const loadingDiv = document.createElement('div');
    loadingDiv.innerText = '更新中... ページを閉じないでください。';
    document.body.appendChild(loadingDiv);

    try {
      // 1. 全レコードのIDを取得
      const allRecords = await fetchAllRecordIds(appId);
      const total = allRecords.length;
      
      // 2. 100件ずつ一括更新
      for (let i = 0; i < total; i += 100) {
        const chunk = allRecords.slice(i, i + 100);
        const updateRecords = chunk.map(id => ({ id: id, record: {} })); // 空更新
        
        await kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', {
          app: appId,
          records: updateRecords
        });
        console.log(`${Math.min(i + 100, total)} / ${total} 件完了`);
      }

      alert('再計算が完了しました！');
      location.reload();
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました。コンソールを確認してください。');
    } finally {
      document.body.removeChild(loadingDiv);
    }
  }

  // 全レコードIDを取得するヘルパー関数
  async function fetchAllRecordIds(appId) {
    let allIds = [];
    let lastId = 0;
    while (true) {
      const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
        app: appId,
        fields: ['$id'],
        query: `$id > ${lastId} order by $id asc limit 500`
      });
      allIds = allIds.concat(resp.records.map(r => r.$id.value));
      if (resp.records.length < 500) break;
      lastId = allIds[allIds.length - 1];
    }
    return allIds;
  }
})();