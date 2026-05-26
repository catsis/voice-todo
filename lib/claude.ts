import { ExtractedData, Priority } from '../types/task';

const SYSTEM_PROMPT = `你是一個待辦事項分析助手。從用戶語音中擷取關鍵資訊，以純 JSON 回傳，無其他文字。

格式：
{
  "action": "句子最前面的動作動詞，直接使用原文，不要改寫或正規化",
  "target": "去掉動作詞後的完整對象描述，保留所有形容詞、規格、顏色等細節，不可省略",
  "time": "時間描述字串，若無則 null",
  "priority": "urgent 或 normal",
  "summary": "動作+對象的簡短摘要（最多15字）"
}

拆解規則：
- action = 句子開頭的動作詞（原文照抄，不要替換同義詞）
- target = 把 action 從句子中移除後，剩下的完整內容
- 形容詞、顏色、規格都屬於 target，不可省略

範例（嚴格按照此格式）：
- 「請購黑色2mm單芯線」→ action: "請購", target: "黑色2mm單芯線"
- 「請購避難指示燈」→ action: "請購", target: "避難指示燈"
- 「聯繫招牌廠商」→ action: "聯繫", target: "招牌廠商"
- 「預約下週三牙醫」→ action: "預約", target: "下週三牙醫"
- 「繳這個月水電費」→ action: "繳費", target: "水電費"
- 「打電話給王工程師」→ action: "聯絡", target: "王工程師"

判斷 priority 規則：
- 含「急」「緊急」「馬上」「立刻」「ASAP」→ priority: urgent`;

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

export async function extractTaskFromVoice(
  transcript: string,
  apiKey: string
): Promise<ExtractedData> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data: AnthropicResponse = await response.json();
  const text = data.content?.[0]?.text ?? '{}';

  let parsed: Partial<ExtractedData & { time: string | null }> = {};
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    parsed = { action: '待辦', target: transcript, summary: transcript.slice(0, 15) };
  }

  let finalAction = parsed.action?.trim() || '';
  let finalTarget = parsed.target?.trim() || '';

  // 若 AI 未能拆解（action 為空或為備援值），嘗試從前2字猜測動作
  if (!finalAction || finalAction === '待辦') {
    const match = transcript.trim().match(/^([一-鿿]{2})([一-鿿])/);
    if (match) {
      const candidate = match[1]; // 前2字作為動作
      const rest = transcript.slice(candidate.length).trim();
      if (rest.length > 0) {
        finalAction = candidate;
        finalTarget = rest;
      }
    }
  }

  if (!finalAction) finalAction = '待辦';
  if (!finalTarget) finalTarget = transcript;

  // 防護：若 target 以 action 開頭代表 AI 未拆，自動去除前綴
  if (finalAction !== '待辦' && finalTarget.startsWith(finalAction)) {
    finalTarget = finalTarget.slice(finalAction.length).trim();
  }

  return {
    action: finalAction,
    target: finalTarget,
    time: parsed.time ?? undefined,
    priority: (parsed.priority as Priority) || 'normal',
    category: finalAction,
    summary: parsed.summary || transcript.slice(0, 15),
  };
}
