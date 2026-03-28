export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json;charset=UTF-8"
    };

    // 從 KV 抓取剛才上傳的內容
    const code = await env.MY_APP_KV.get("latest_app_js");

    const data = {
      message: "抓取成功！",
      content: code || "目前雲端沒有資料",
      time: new Date().toLocaleString()
    };

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  },
};
