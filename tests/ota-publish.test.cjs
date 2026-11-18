const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadPublish(pages) {
  const calls = [];
  const request = async (path, method = 'GET') => {
    calls.push({ path, method });
    if (method === 'POST') return;
    const page = pages.shift();
    if (page instanceof Error) throw page;
    assert(page, 'Unexpected package query');
    return page;
  };
  const client = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/api/ota/client.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports: client.exports, URLSearchParams,
    require: (name) => {
      if (name.includes('iam/client')) return { request };
      if (name.includes('device/client')) return { query: () => '' };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const source = ts.createSourceFile('firmware.tsx', fs.readFileSync('src/components/ota/firmware.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'publishVersion') callback = node.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert(callback, 'Missing firmware publish callback');
  const publish = vm.runInNewContext(ts.transpileModule(`${callback}\npublishVersion;`, {}).outputText, {
    ...client.exports, projectId: 'project-1', versionId: 'version-1',
    versions: { mutate: async () => {} }, selectedResource: { mutate: async () => {} },
  });
  return { publish, calls };
}
const empty = () => ({ items: [], hasMore: false, nextCursor: null });
const pkg = (state = 'VERIFIED', targetVersionId = 'version-1') => ({
  id: 'pkg-1', targetVersionId, state, packageType: 'FULL',
  files: [{ fileId: 'file-1', fileRole: 'FIRMWARE', sizeBytes: 100, orderNo: 0 }],
});

test('empty firmware cannot send a publish request', async () => {
  const { publish, calls } = loadPublish([empty()]);
  await assert.rejects(publish, /升级包/);
  assert.equal(calls.some(c => c.method === 'POST'), false);
});

test('package lookup failure prevents publishing', async () => {
  const { publish, calls } = loadPublish([new Error('Package lookup failed')]);
  await assert.rejects(publish, /Package lookup failed/);
  assert.equal(calls.some(c => c.method === 'POST'), false);
});

for (const invalid of [pkg('DRAFT'), pkg('BUILDING'), pkg('SEALED'), pkg('VERIFIED', 'other-version'), { ...pkg(), files: [] }]) {
  test(`unusable package is rejected: ${invalid.state}/${invalid.targetVersionId}/${invalid.files.length}`, async () => {
    const { publish, calls } = loadPublish([{ ...empty(), items: [invalid] }]);
    await assert.rejects(publish, /升级包/);
    assert.equal(calls.some(c => c.method === 'POST'), false);
  });
}

test('checks later package pages before publishing', async () => {
  const { publish, calls } = loadPublish([
    { items: [], hasMore: true, nextCursor: 'next-page' },
    { ...empty(), items: [pkg()] },
  ]);
  await publish();
  assert.equal(calls.length, 3);
  assert.match(calls[1].path, /cursor=next-page/);
  assert.equal(calls[2].path, '/api/v1/ota/firmware/versions/version-1/publish');
  assert.equal(calls[2].method, 'POST');
});
