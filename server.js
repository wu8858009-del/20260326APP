export default {
  async fetch(request) {
    // 這裡可以寫您的邏輯，例如判斷時間、處理資料等
    const data = {
      message: "您好！這是來自 Cloudflare 123",
      time: new Date().toLocaleString()
    };

    return new Response(JSON.stringify(data), {
      headers: { 
        "content-type": "application/json;charset=UTF-8",
        "Access-Control-Allow-Origin": "*" // 允許您的 App 跨網域抓取
      },
    });
  },
};