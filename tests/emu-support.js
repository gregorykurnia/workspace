// Helpers for the specs that run under `npm run test:emu`. Playwright runs only *.spec.js, so this file is not a test.
// The rules refuse a list query that doesn't say which privateTo it wants (spec §D), and the current app's five
// listeners are unfiltered until plan 2.1. Until then the page is served store.js with the one filter 2.1 adds
// for a visitor-sized read (privateTo == null, which is every item here); the writes, the move stamping and the
// reads of single documents are the app's own. Delete this shim, and every use of it, in 2.1.
// (plan 2.4) The admin's pages read the private items too, as 2.1 will, so the admin can undo what they made private.
const FILTER_LISTENERS = /db\.collection\('(folders|moms|docs|docfolders|momfolders)'\)\.onSnapshot\(/g;
// With a uid (an admin's page), each collection is read twice, privateTo == null and privateTo == uid, and the two
// snapshots are merged by id before the app's own handler runs: the shape plan 2.1 gives the real listeners.
const merge = uid => `
function _emuListen(col,opt,h,err){
  var s=[null,null];
  [null,${JSON.stringify(uid)}].forEach(function(v,i){
    db.collection(col).where('privateTo','==',v).onSnapshot(opt,function(snap){
      s[i]=snap;if(!s[0]||!s[1])return;
      var seen={},docs=[];s.forEach(function(x){x.docs.forEach(function(d){if(!seen[d.id]){seen[d.id]=1;docs.push(d);}});});
      h({metadata:{fromCache:s[0].metadata.fromCache||s[1].metadata.fromCache},docs:docs,docChanges:function(){return snap.docChanges();}});
    },err);
  });
}
`;
async function filterListeners(context, uid) {
  await context.route('**/js/data/store.js', async route => {
    const res = await route.fetch();
    let body = await res.text();
    body = uid
      ? body.replace(FILTER_LISTENERS, "_emuListen('$1',") + merge(uid)
      : body.replace(FILTER_LISTENERS, "db.collection('$1').where('privateTo','==',null).onSnapshot(");
    await route.fulfill({ response: res, body });
  });
}

module.exports = { filterListeners };
