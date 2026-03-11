/* config_specific.js */
(function () {
    'use strict';

    // グローバル変数に設定オブジェクトを保存
    // ※先ほどの全件更新用とは別の名前(bulkUpdateSpecificConfig)にして、混ざらないようにしています
    window.bulkUpdateSpecificConfig = {

        // 【検索条件】kintoneのクエリ形式で記述
        // 例: '手配 in ("冨士ファニチア㈱")' 
        queryCondition: '運送便コード in ("1S")',

        // 【更新対象】フィールドコード
        updateFieldCode: '確定区分',

        // 【更新後の値】
        updateValue: '確定',

        // 【ボタンの表示名】
        buttonLabel: '運確定区分一括更新-1Sのみ(確定)',

        // 【除外条件の演算子】 '!=' または 'not in'
        // ドロップダウンや複数選択の場合は 'not in' を推奨
        excludeOperator: 'not in'
    };

})();