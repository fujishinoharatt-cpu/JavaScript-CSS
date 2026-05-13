/**
 * 008-ダッシュボード用 AI分析プロキシ (GAS) - Ver.1.3.7
 */

const GEMINI_API_KEY = 'AIzaSyAhJYYcAJE3FCfczEMvH8k_BjfZ1ccYYtE';
const SPREADSHEET_ID = '1H7g15zBeVTGG-cTffHKQlAnb20x5rossDZGA5NChDfM';
const SHEET_NAME = 'シート1';

function doPost(e) {
  const debugLog = [];
  const startTime = new Date().getTime();
  
  try {
    const params = JSON.parse(e.postData.contents);
    const { title, query_key, target_name, target_period, records, force_refresh } = params;

    // キーの正規化 (スペース除去 & 「の詳細」除去)
    const normalizedKey = (query_key || title || "").replace('の詳細', '').replace(/\s+/g, '');
    debugLog.push(`[Search] Key: ${normalizedKey}`);

    // 1. スプレッドシートから検索
    const searchResult = findInSpreadsheetWithDebug(normalizedKey);
    debugLog.push(searchResult.message);
    
    if (!force_refresh && searchResult.success) {
      const endTime = new Date().getTime();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        analysis_result: searchResult.data,
        cached: true,
        debug_info: debugLog.join(' / '),
        elapsed_ms: endTime - startTime
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. 新規分析の実行 (recordsがない場合は分析不可)
    if (!records || records.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: '過去の分析が見つからず、新規分析用のデータも空です。',
        debug_info: debugLog.join(' / ')
      })).setMimeType(ContentService.MimeType.JSON);
    }

    debugLog.push(`[AI] Starting new analysis...`);
    const analysisResult = callGemini(records, target_name, target_period);

    // 3. 保存 (title はそのまま保存するが、検索時は正規化する)
    if (analysisResult && analysisResult.length > 20) {
      saveToSpreadsheet(title, target_name, target_period, analysisResult, records.length);
      debugLog.push(`[Save] Done.`);
    }

    const endTime = new Date().getTime();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      analysis_result: analysisResult,
      cached: false,
      debug_info: debugLog.join(' / '),
      elapsed_ms: endTime - startTime
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      debug_info: debugLog.join(' / ')
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function findInSpreadsheetWithDebug(normalizedKey) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return { success: false, message: '[Error] Sheet not found' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: '[Search] Empty sheet' };

    const titles = sheet.getRange(1, 2, lastRow, 1).getValues();
    const contents = sheet.getRange(1, 6, lastRow, 1).getValues();

    for (let i = lastRow - 1; i >= 1; i--) {
      // 比較対象からも「の詳細」と「スペース」を除去
      const sheetTitle = String(titles[i][0] || "").replace('の詳細', '').replace(/\s+/g, '');
      if (sheetTitle === normalizedKey) {
        const content = contents[i][0];
        if (content && content.length > 20) {
          return { 
            success: true, 
            data: content.replace(/\n/g, '<br>'), 
            message: `[Hit] Row ${i + 1}` 
          };
        }
      }
    }
    return { success: false, message: '[Miss] No match' };
  } catch (e) {
    return { success: false, message: `[Error] ${e.toString()}` };
  }
}

function callGemini(records, name, period) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const recordText = records.map(r => {
    return `- 接客スタッフ: ${r['接客スタッフ']}\n  お客様: ${r['お客様名']}\n  対応内容: ${r['対応内容']}\n  見られた商品: ${r['見られた商品番']}\n  見積金額: ${r['見積金額']}`;
  }).join('\n\n');

  const prompt = `
あなたは優秀な店舗運営コンサルタントです。
以下の接客記録データ（対象：${name}、期間：${period}）を分析し、
「接客の傾向」「お客様のニーズ」「今後の成約率向上のためのアドバイス」を
300文字〜500文字程度で分かりやすくまとめてください。
出力はHTML形式で。

【データ】
${recordText}
  `;

  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  
  if (json.candidates && json.candidates[0].content.parts[0].text) {
    return json.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Geminiからの応答が不正です');
  }
}

function saveToSpreadsheet(title, name, period, result, count) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['実行日時', '分析タイトル', '対象名', '対象期間', '集計件数', '分析結果']);
    }

    const plainResult = result.replace(/<br>/g, '\n').replace(/<[^>]*>?/gm, '');

    sheet.appendRow([
      new Date(),
      title,
      name,
      period,
      count,
      plainResult
    ]);
  } catch (e) {
    console.error('Spreadsheet Save Error:', e);
  }
}
