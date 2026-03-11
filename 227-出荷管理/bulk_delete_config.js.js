/* bulk_delete_config.js */
(function() {
    'use strict';

    window.bulkDeleteConfig = {
        
        // 対象のフィールドコード
        targetFieldCode: '手配',

        // 【変更点】削除対象のキーワード
        // 「㈱」を消し、「オリジン」という文字が含まれていれば消すようにします
        targetValue: 'オリジン',

        // ボタンの表示名
        buttonLabel: 'レコード一括削除（オリジン・空白）'
    };

})();