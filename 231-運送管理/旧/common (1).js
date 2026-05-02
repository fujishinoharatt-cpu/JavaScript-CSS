    //***********************************************************************************
    //すべての型の空を判定する
    //引数１：任意の数の判定する変数
    //***********************************************************************************
    function Is_All_Empty(...variables) {

        return variables.every(variable => {

            if (variable === null || variable === undefined || variable === "") {

                return true;

            }

            if (Array.isArray(variable) && variable.length === 0) {

                return true;

            }

            if (typeof variable === "object" && Object.keys(variable).length === 0) {

                return true;

            }

            if (typeof variable === "number" && isNaN(variable)) {

                return true;

            }

            return false;

        });
    }

    //***********************************************************************************
    //指定フィールドの表示/非表示
    //引数１：レコード　引数２：フィールドコート名(配列)　引数３：true / false
    //***********************************************************************************
    function Select_Disabled_Field(tmp_record, field_array, tmp_bool) {

        var i = 0;

        for(i = 0; i < field_array.length; i++) {

        tmp_record[field_array[i]].disabled = tmp_bool;
        

        }

    }

    //***********************************************************************************
    //指定アプリ番号からテーブル情報を取得する
    //引数１：アプリ番号　引数２：クエリ　引数３：取得フィールド
    //返値：テーブル(レコード)情報
    //***********************************************************************************
    function Get_APP_Table(app_id, query, fields) {

        var output_data;

        const params = {
            app: app_id,
            query: query,
            fields: fields
        };

        //テーブルを取得
        return kintone.api(kintone.api.url('/k/v1/records.json', true), 'GET', params).then((resp) => {

            output_data = resp.records;
            return output_data;

        }).catch((error) => {

            console.log(error);

        });

    }