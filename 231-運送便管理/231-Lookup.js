(function() {
  'use strict';

  // 【設定】更新したいルックアップのフィールドコードをすべて配列に入れてください
  const LOOKUP_FIELDS = ['運送会社コード1', '運送会社コード2']; 

  kintone.events.on('app.record.index.show', function(event) {
    if (document.getElementById('recalc_lookup_multi_button') !== null) return;

    const btn = document.createElement('button');
    btn.id = 'recalc_lookup_multi_button';
    btn.innerHTML = '複数ルックアップ一括更新';
    btn.className = 'kintone-ui-button-common';
    btn.onclick = function() {
      if (confirm('「' + LOOKUP_FIELDS.join(', ') + '」を再取得しますか？')) {
        recalculateMultiLookup(kintone.app.getId());
      }
    };
    kintone.app.getHeaderMenuSpaceElement().appendChild(btn);
  });

  async function recalculateMultiLookup(appId) {
    const loadingDiv = document.createElement('div');
    loadingDiv.style = "position: fixed; top: 0; left: 0; width: 100%; background: rgba(0,0,0,0.5); color: white; text-align: center; padding: 10px; z-index: 1000;";
    loadingDiv.innerText = 'ルックアップ一括更新中... 画面を閉じないでください。';
    document.body.appendChild(loadingDiv);

    try {
      // 1. IDと対象ルックアップフィールドの現在の値を取得
      const allRecords = await fetchRecordsWithFields(appId, LOOKUP_FIELDS);
      const total = allRecords.length;
      
      // 2. 100件ずつ一括更新
      for (let i = 0; i < total; i += 100) {
        const chunk = allRecords.slice(i, i + 100);
        
        const updateRecords = chunk.map(rec => {
          const updateData = { id: rec.$id.value, record: {} };
          // 指定されたすべてのルックアップフィールドに今の値をセットする
          LOOKUP_FIELDS.forEach(fieldCode => {
            updateData.record[fieldCode] = { value: rec[fieldCode].value };
          });
          return updateData;
        });
        
        await kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', {
          app: appId,
          records: updateRecords
        });
        console.log(`${Math.min(i + 100, total)} / ${total} 件完了`);
      }

      alert('すべてのルックアップの再取得が完了しました！');
      location.reload();
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました。コンソールを確認してください。');
    } finally {
      document.body.removeChild(loadingDiv);
    }
  }

  // 必要なフィールドに絞ってレコード全件取得
  async function fetchRecordsWithFields(appId, fieldCodes) {
    let allRecords = [];
    let lastId = 0;
    const fetchFields = ['$id', ...fieldCodes];
    
    while (true) {
      const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
        app: appId,
        fields: fetchFields,
        query: `$id > ${lastId} order by $id asc limit 500`
      });
      allRecords = allRecords.concat(resp.records);
      if (resp.records.length < 500) break;
      lastId = allRecords[allRecords.length - 1].$id.value;
    }
    return allRecords;
  }
})();