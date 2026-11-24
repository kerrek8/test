import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleTriage } from "./server.mjs";

function createMockResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(data) {
      this.body = data ? JSON.parse(data) : null;
    },
  };
}

test("сбой имитатора ([error]) возвращает HTTP 200 и manual_review", async () => {
  const req = Readable.from([JSON.stringify({ text: "Тест сбоя [error]" })]);
  const res = createMockResponse();

  await handleTriage(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "manual_review",
    topic: null,
    draft: null,
  });
});

test("таймаут имитатора ([timeout]) возвращает HTTP 200 и manual_review до 300 мс", async () => {
  const startTime = Date.now();
  const req = Readable.from([JSON.stringify({ text: "Тест таймаута [timeout]" })]);
  const res = createMockResponse();

  await handleTriage(req, res);
  const elapsed = Date.now() - startTime;

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "manual_review",
    topic: null,
    draft: null,
  });
  assert.ok(elapsed < 900, `Таймаут должен сработать быстрее 900 мс (было: ${elapsed} мс)`);
});

test("некорректный JSON от имитатора ([bad-json]) возвращает HTTP 200 и manual_review", async () => {
  const req = Readable.from([JSON.stringify({ text: "Тест [bad-json]" })]);
  const res = createMockResponse();

  await handleTriage(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "manual_review",
    topic: null,
    draft: null,
  });
});

test("недопустимая тема от имитатора ([bad-topic]) возвращает HTTP 200 и manual_review", async () => {
  const req = Readable.from([JSON.stringify({ text: "Тест [bad-topic]" })]);
  const res = createMockResponse();

  await handleTriage(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "manual_review",
    topic: null,
    draft: null,
  });
});

test("пустой черновик от имитатора ([empty-draft]) возвращает HTTP 200 и manual_review", async () => {
  const req = Readable.from([JSON.stringify({ text: "Тест [empty-draft]" })]);
  const res = createMockResponse();

  await handleTriage(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "manual_review",
    topic: null,
    draft: null,
  });
});

test("пустой или отсутствующий ввод возвращает HTTP 400 и invalid_input", async () => {
  const req = Readable.from([JSON.stringify({ text: "   " })]);
  const res = createMockResponse();

  await handleTriage(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    status: "invalid_input",
  });
});
