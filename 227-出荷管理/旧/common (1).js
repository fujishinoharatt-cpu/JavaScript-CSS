//***********************************************************
//現在の年月日を取得する
//***********************************************************
function Get_Now_Date() {

	var output_data = "";
	var now_date = new Date();
	var year = now_date.getFullYear();
	var month = now_date.getMonth() + 1;
	var day = now_date.getDate();

	output_data = year + '-' + month + '-' + day;

	return output_data;

}

//***********************************************************
//アラート表示(指定時間後にアラートが自動で消える)
//引数１：表示メッセージ　引数２：表示時間　引数３：背景色
//***********************************************************
function Timer_Alert(message, duration, back_color) {

	// 既存のalert要素を非表示にする（もしあれば）
	var existingAlert = document.getElementById('myCustomAlert');

	if (existingAlert) {

		existingAlert.style.display = 'none';

	}

	// 新しいalert要素を作成・表示
	var alertDiv = document.createElement('div');

	alertDiv.id = 'myCustomAlert';
	alertDiv.innerHTML = message;
	alertDiv.style.position = 'fixed';
	alertDiv.style.top = '50%';
	alertDiv.style.left = '50%';
	alertDiv.style.transform = 'translate(-50%, -50%)';
	alertDiv.style.color = 'white';
	alertDiv.style.background = back_color;
	alertDiv.style.opacity = '0.8';
	alertDiv.style.fontWeight = '900';
	alertDiv.style.padding = '20px';
	alertDiv.style.border = '2px solid black';
	alertDiv.style.zIndex = '1000'; // 他の要素より前面に表示

	document.body.appendChild(alertDiv);

	// 指定時間後に消す
	setTimeout(() => {

		alertDiv.style.display = 'none';
		document.body.removeChild(alertDiv); // DOMから削除

	}, duration);

}