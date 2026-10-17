/**
 * Is a feature switched on for an organisation? The jobs skip organisations that turned a
 * feature off (its emails pause; nothing is deleted). Same rules as the app: src/lib/features.js.
 * One read per organisation per run.
 */
const path = require('path');
const { pathToFileURL } = require('url');

let lib = null;
const cache = new Map();

async function orgHasFeature(db, orgId, id) {
  lib ||= await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'lib', 'features.js')).href);
  if (!cache.has(orgId)) {
    const snap = await db.collection('organizations').doc(String(orgId)).collection('features').doc('settings').get();
    cache.set(orgId, lib.enabledFrom(snap.exists ? snap.data() : null));
  }
  return lib.featureOn(cache.get(orgId), id);
}

module.exports = { orgHasFeature };
