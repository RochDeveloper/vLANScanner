'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateExternalUrl } = require('./external-url');

test('validateExternalUrl permite únicamente protocols seguros', () => {
  assert.equal(validateExternalUrl('http://10.0.0.1'), 'http://10.0.0.1/');
  assert.equal(validateExternalUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(validateExternalUrl('ms-rd:v=10.0.0.1'), 'ms-rd:v=10.0.0.1');
  assert.throws(() => validateExternalUrl('file:///C:/Windows/System32/cmd.exe'), /no permitido/);
  assert.throws(() => validateExternalUrl('javascript:alert(1)'), /no permitido/);
  assert.throws(() => validateExternalUrl('not-a-url'), /inválida/);
});
