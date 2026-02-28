// POST /api/auth — Authenticate with SG Sistemas
// Tries multiple body formats since we don't know exact format

export async function POST(request) {
  try {
    const { url, user, pass } = await request.json();
    if (!url || !user || !pass) {
      return Response.json({ error: "URL, usuário e senha obrigatórios" }, { status: 400 });
    }

    const baseUrl = url.replace(/\/+$/, "");
    const authUrl = `${baseUrl}/autorizacao`;
    console.log(`[AUTH] POST ${authUrl}`);
    console.log(`[AUTH] User: ${user}`);

    // Try multiple body formats
    const formats = [
      // Format 1: { usuario, senha }
      { usuario: user, senha: pass },
      // Format 2: { user, password }
      { user, password: pass },
      // Format 3: { username, password }
      { username: user, password: pass },
      // Format 4: { login, senha }
      { login: user, senha: pass },
    ];

    let lastError = "";
    let lastStatus = 0;

    for (let i = 0; i < formats.length; i++) {
      const body = formats[i];
      console.log(`[AUTH] Trying format ${i + 1}: ${JSON.stringify(Object.keys(body))}`);

      try {
        const res = await fetch(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const responseText = await res.text();
        console.log(`[AUTH] Format ${i + 1}: HTTP ${res.status} — ${responseText.substring(0, 300)}`);

        if (res.ok || res.status === 200 || res.status === 201) {
          // Try to parse as JSON
          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            // Response might be the token itself as plain text
            if (responseText && responseText.length > 10) {
              return Response.json({
                success: true,
                token: responseText.trim().replace(/"/g, ""),
                format: i + 1,
              });
            }
            continue;
          }

          // Extract token from various response formats
          const token =
            data.token ||
            data.access_token ||
            data.Token ||
            data.accessToken ||
            data.jwt ||
            data.bearer ||
            (typeof data === "string" ? data : null);

          if (token) {
            console.log(`[AUTH] Success with format ${i + 1}! Token: ${String(token).substring(0, 30)}...`);
            return Response.json({
              success: true,
              token: String(token),
              format: i + 1,
              raw: data,
            });
          }

          // Maybe the entire response IS the token data
          if (data && typeof data === "object") {
            // Look for any string field that looks like a JWT
            for (const [key, val] of Object.entries(data)) {
              if (typeof val === "string" && val.includes(".") && val.length > 50) {
                console.log(`[AUTH] Found token in field '${key}'`);
                return Response.json({
                  success: true,
                  token: val,
                  format: i + 1,
                  tokenField: key,
                  raw: data,
                });
              }
            }
          }

          // If we got a 200 but can't find token, return what we got
          console.log(`[AUTH] Got 200 but no token found in response`);
          lastError = `Resposta 200 mas token não encontrado: ${JSON.stringify(data).substring(0, 200)}`;
        } else {
          lastError = responseText.substring(0, 200);
          lastStatus = res.status;
        }
      } catch (fetchErr) {
        console.warn(`[AUTH] Format ${i + 1} error: ${fetchErr.message}`);
        lastError = fetchErr.message;
      }
    }

    return Response.json(
      { error: `Autenticação falhou: ${lastError}`, status: lastStatus },
      { status: 401 }
    );
  } catch (err) {
    console.error("[AUTH] Fatal:", err);
    return Response.json({ error: "Erro de conexão", detail: err.message }, { status: 500 });
  }
}
