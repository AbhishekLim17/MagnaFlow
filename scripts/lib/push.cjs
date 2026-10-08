/**
 * Push notifications to a person's devices (Firebase Cloud Messaging via the Admin SDK; free
 * on the Spark plan). Devices register at users/{uid}/pushTokens/{token} (src/services/
 * pushService.js). Data-only messages: public/sw.js shows them and opens the link.
 *
 * Best-effort: a push that fails never fails the email it goes with. Tokens FCM says are dead
 * are deleted. With MAIL_TRANSPORT=json (integration tests) pushes are printed, not sent.
 */
const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * @param {{ db, admin }} deps
 * @param {string} uid
 * @param {{ title: string, body?: string, link: string, tag?: string }} note
 * @returns {Promise<number>} devices it was sent to
 */
async function sendPush({ db, admin }, uid, note) {
  if (!uid) return 0;
  try {
    const snap = await db.collection('users').doc(uid).collection('pushTokens').get();
    if (snap.empty) return 0;
    const tokens = snap.docs.map((d) => d.id);
    const data = { title: clip(note.title, 120), body: clip(note.body, 240), link: note.link || '/', tag: note.tag || '' };
    if (process.env.MAIL_TRANSPORT === 'json') {
      console.log('[push-json] ' + JSON.stringify({ uid, tokens: tokens.length, ...data }));
      return tokens.length;
    }
    const res = await admin.messaging().sendEachForMulticast({ tokens, data, webpush: { headers: { Urgency: 'normal' } } });
    await Promise.all(res.responses.map((r, i) => (!r.success && DEAD.has(r.error?.code)
      ? snap.docs[i].ref.delete().catch(() => {})
      : null)));
    return res.successCount;
  } catch (error) {
    console.warn(`  push to ${uid} skipped: ${error?.message}`);
    return 0;
  }
}

module.exports = { sendPush };
