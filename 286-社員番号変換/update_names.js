/* update_names.js - 清書版 */
(function () {
  'use strict';

  const CONFIG = {
    B_APP_TOKEN: 'EbyA3TUAyjCof50cKfQkaoDOmgwlDgTSFoZ6W6TJ', // ★ここにご自身のトークンを入れてください
    B_APP_ID: 287,
    A_FIELD_NO: 'emp_no',
    A_FIELD_NAME: '氏名',
    A_FIELD_SECTION_CODE: '課コード',
    A_FIELD_SECTION_NAME: '課名',
    B_FIELD_NO: '社員NO',
    B_FIELD_NAME: '氏名',
    B_FIELD_SECTION_CODE: '課コード',
    B_FIELD_SECTION_NAME: '課名'
  };

  kintone.events.on('app.record.index.show', function (event) {
    if (document.getElementById('update_btn')) return;

    const btn = document.createElement('button');
    btn.id = 'update_btn';
    btn.innerText = '【氏名一括更新】287社員情報 利用';
    btn.className = 'kintoneplugin-button-dialog-ok'; // kintone標準風の青いボタン

    btn.onclick = async function () {
      if (!confirm('実行しますか？')) return;

      try {
        const bMap = new Map();
        let lastRecordId = 0;

        // Bアプリから全件取得（ループ処理）
        while (true) {
          const bAppResponse = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
            app: CONFIG.B_APP_ID,
            query: `$id > ${lastRecordId} order by $id asc limit 500`,
            headers: { 'X-Cybozu-API-Token': CONFIG.B_APP_TOKEN }
          });

          const records = bAppResponse.records;
          if (records.length === 0) break;

          records.forEach(rec => {
            const no = rec[CONFIG.B_FIELD_NO]?.value;
            if (no) {
              const bData = {
                name: rec[CONFIG.B_FIELD_NAME]?.value,
                sectionCode: rec[CONFIG.B_FIELD_SECTION_CODE]?.value,
                sectionName: rec[CONFIG.B_FIELD_SECTION_NAME]?.value
              };
              bMap.set(String(no).trim(), bData);
            }
          });

          lastRecordId = records[records.length - 1].$id.value;
          if (records.length < 500) break;
        }



        const updatePayload = event.records.map(aRec => {
          const shainNo = aRec[CONFIG.A_FIELD_NO]?.value ? String(aRec[CONFIG.A_FIELD_NO].value).trim() : null;
          const bData = bMap.get(shainNo);

          if (!bData) return null;

          const record = {};
          let needsUpdate = false;

          // 氏名更新
          if (bData.name !== undefined && aRec[CONFIG.A_FIELD_NAME]?.value !== bData.name) {
            record[CONFIG.A_FIELD_NAME] = { value: bData.name };
            needsUpdate = true;
          }
          // 課コード更新
          if (bData.sectionCode !== undefined && aRec[CONFIG.A_FIELD_SECTION_CODE]?.value !== bData.sectionCode) {
            record[CONFIG.A_FIELD_SECTION_CODE] = { value: bData.sectionCode };
            needsUpdate = true;
          }
          // 課名更新
          if (bData.sectionName !== undefined && aRec[CONFIG.A_FIELD_SECTION_NAME]?.value !== bData.sectionName) {
            record[CONFIG.A_FIELD_SECTION_NAME] = { value: bData.sectionName };
            needsUpdate = true;
          }

          if (needsUpdate) {
            return {
              id: aRec.$id.value,
              record: record
            };
          }
          return null;
        }).filter(item => item !== null);

        if (updatePayload.length === 0) {
          alert('更新が必要なデータはありませんでした。');
          return;
        }

        for (let i = 0; i < updatePayload.length; i += 100) {
          await kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', {
            app: kintone.app.getId(),
            records: updatePayload.slice(i, i + 100)
          });
        }

        alert(updatePayload.length + ' 件更新しました。');
        location.reload();

      } catch (error) {
        // エラー時は開発者が追えるようにコンソールに残し、ユーザーには簡潔に伝える
        console.error('Update Error:', error);
        alert('エラーが発生しました。フィールドコードや権限を再確認してください。');
      }
    };

    kintone.app.getHeaderMenuSpaceElement().appendChild(btn);
  });
})();