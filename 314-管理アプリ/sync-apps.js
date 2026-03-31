(function() {
  'use strict';

  // 一覧画面が表示されたときの処理
  kintone.events.on('app.record.index.show', function(event) {
    // 既にボタンが存在する場合は作らない（画面遷移時の増殖防止）
    if (document.getElementById('fetch-apps-btn') !== null) {
      return event;
    }

    // 1. ヘッダー部分にボタンを作成
    const fetchBtn = document.createElement('button');
    fetchBtn.id = 'fetch-apps-btn';
    fetchBtn.innerHTML = 'kintone内の全アプリを取得・登録';
    fetchBtn.style.margin = '10px 15px';
    fetchBtn.style.padding = '8px 16px';
    fetchBtn.style.backgroundColor = '#3498db';
    fetchBtn.style.color = '#fff';
    fetchBtn.style.border = 'none';
    fetchBtn.style.borderRadius = '4px';
    fetchBtn.style.cursor = 'pointer';

    // 2. ボタンをクリックしたときの処理
    fetchBtn.onclick = function() {
      fetchBtn.innerHTML = '取得中...';
      fetchBtn.disabled = true;

      // kintoneの全アプリ情報を取得（最大100件まで）
      kintone.api(kintone.api.url('/k/v1/apps.json', true), 'GET', { limit: 100 }, async (resp) => {
        const apps = resp.apps;
        
        if (!apps || apps.length === 0) {
          alert('取得できるアプリがありません。');
          fetchBtn.innerHTML = 'kintone内の全アプリを取得・登録';
          fetchBtn.disabled = false;
          return;
        }

        try {
          // 現在この管理アプリ（314）に登録されているアプリIDを全件取得して比較する
          const currentRecordsResp = await kintone.api(kintone.api.url('/k/v1/records.json', true), 'GET', {
            app: kintone.app.getId(),
            fields: ['appId'] // フィールドコード「appId」のみ取得
          });
          
          // 既に登録済みのアプリIDリスト（数値の配列）
          const existingAppIds = currentRecordsResp.records.map(rec => Number(rec.appId.value));

          // 現在のドメインURLを取得 (例: "https://your-domain.cybozu.com")
          const domainUrl = location.origin;

          // まだ登録されていないアプリだけを抽出（差分チェック）
          const newRecords = [];
          
          apps.forEach(app => {
            if (!existingAppIds.includes(Number(app.appId))) {
              
              // アプリの一覧画面(URL) を組み立てる
              const currentAppUrl = `${domainUrl}/k/${app.appId}/`;
              
              newRecords.push({
                appId: { value: app.appId },
                appName: { value: app.name },
                appUrl: { value: currentAppUrl } // ★ ここで「アプリのURL」を追加！
              });
            }
          });

          if (newRecords.length === 0) {
            alert('すべてのアプリが既に登録されています！（新しいアプリはありません）');
            fetchBtn.innerHTML = 'kintone内の全アプリを取得・登録';
            fetchBtn.disabled = false;
            return;
          }

          // 新しいアプリが見つかった場合、一括登録(POST)する
          if (confirm(`未登録のアプリが ${newRecords.length} 件見つかりました。\n※例: ${newRecords[0].appName.value}\n\nこれらを管理アプリに一括で追加しますか？`)) {
            
            kintone.api(kintone.api.url('/k/v1/records.json', true), 'POST', {
              app: kintone.app.getId(),
              records: newRecords
            }, (postResp) => {
              alert(`成功！ ${newRecords.length} 件のアプリを新しく登録しました。`);
              location.reload(); // 画面を更新して最新を表示
            }, (error) => {
              console.error(error);
              alert('登録処理に失敗しました。詳細: ' + error.message);
              fetchBtn.innerHTML = 'kintone内の全アプリを取得・登録';
              fetchBtn.disabled = false;
            });
            
          } else {
            fetchBtn.innerHTML = 'kintone内の全アプリを取得・登録';
            fetchBtn.disabled = false;
          }

        } catch (err) {
          console.error('既存レコードのチェック中にエラーが発生しました', err);
          alert('エラーが発生しました。コンソールを確認してください。');
          fetchBtn.innerHTML = 'kintone内の全アプリを取得・登録';
          fetchBtn.disabled = false;
        }

      }, (error) => {
        console.error(error);
        alert('アプリ一覧の取得に失敗しました。権限が不足している可能性があります。');
        fetchBtn.innerHTML = 'kintone内の全アプリを取得・登録';
        fetchBtn.disabled = false;
      });
    };

    // 3. 画面のヘッダーメニュー領域（レコード一覧の上部）にボタンを追加
    kintone.app.getHeaderMenuSpaceElement().appendChild(fetchBtn);

    return event;
  });

})();
