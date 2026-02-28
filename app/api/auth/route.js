export async function POST(request) {
  try {
    const { url, user, pass } = await request.json();
    if (!url || !user || !pass) {
      return Response.json({ error: "URL, usuário e senha obrigatórios" }, { status: 400 });
    }

    const baseUrl = url.replace(/\/+$/, "");
    
    // Try multiple auth patterns that SG Sistemas might use
    const authAttempts = [
      { url: `${baseUrl}/autorizacao`, body: { usuario: user, senha: pass } },
      { url: `${baseUrl}/autorizacao`, body: { login: user, senha: pass } },
      { url: `${baseUrl}/autorizacao`, body: { username: user, password: pass } },
      { url: `${baseUrl}/autorizacao`, body: { user, pass } },
    ];

    let lastError = "";
    for (const attempt of authAttempts) {
      try {
        const res = await fetch(attempt.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(attempt.body),
        });

        const text = await res.text();
        
        if (res.ok || res.status === 200 || res.status === 201) {
          let data;
          try { data = JSON.parse(text); } catch { data = text; }
          
          // Extract token from various response formats
          const token = typeof data === "string" ? data :
            data.token || data.Token || data.access_token || data.accessToken ||
            data.jwt || data.JWT || data.Authorization || data.authorization ||
            data.data?.token || data.data?.Token || data.result?.token ||
            JSON.stringify(data);

          return Response.json({ success: true, token: String(token).replace(/^"|"$/g, ""), raw: data });
        }
        lastError = `${res.status}: ${text.substring(0, 200)}`;
      } catch (err) {
        lastError = err.message;
      }
    }

    // Also try Basic Auth approach
    try {
      const basicToken = Buffer.from(`${user}:${pass}`).toString("base64");
      const res = await fetch(`${baseUrl}/produtos?limit=1`, {
        headers: { "Authorization": `Basic ${basicToken}`, "Accept": "application/json" },
      });
      if (res.ok) {
        return Response.json({ success: true, token: `Basic ${basicToken}`, authType: "basic" });
      }
    } catch {}

    return Response.json({ error: `Autenticação falhou: ${lastError}` }, { status: 401 });
  } catch (err) {
    return Response.json({ error: `Erro de conexão: ${err.message}` }, { status: 500 });
  }
}
