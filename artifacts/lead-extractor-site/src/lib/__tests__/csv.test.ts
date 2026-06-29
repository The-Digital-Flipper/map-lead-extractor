import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv, normalizePhone, isValidEmail, cleanRows, type CleanOptions } from "../csv.ts";

const ALL_OFF: CleanOptions = {
  trim: false, dropNoContact: false, dedupeExact: false, dedupeEmail: false,
  dedupePhone: false, normalizePhone: false, lowerEmail: false, dropInvalidEmail: false,
};

test("parseCsv: headers + rows, quoted fields with commas and newlines", () => {
  const csv = 'name,email\n"Acme, Inc.",a@b.com\n"Line\nBreak",c@d.com';
  const { headers, rows } = parseCsv(csv);
  assert.deepEqual(headers, ["name", "email"]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], "Acme, Inc.");
  assert.equal(rows[1][0], "Line\nBreak");
});

test("parseCsv: escaped double-quotes", () => {
  const { rows } = parseCsv('q\n"She said ""hi"""');
  assert.equal(rows[0][0], 'She said "hi"');
});

test("toCsv: round-trips values needing escaping", () => {
  const csv = toCsv(["a", "b"], [["x,y", 'has "quote"']]);
  const back = parseCsv(csv);
  assert.deepEqual(back.rows[0], ["x,y", 'has "quote"']);
});

test("normalizePhone: formats 10- and 11-digit US numbers", () => {
  assert.equal(normalizePhone("5551234567"), "(555) 123-4567");
  assert.equal(normalizePhone("1-555-123-4567"), "(555) 123-4567");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+44 20 7946 0958"); // left as-is
});

test("isValidEmail", () => {
  assert.ok(isValidEmail("a@b.com"));
  assert.ok(!isValidEmail("nope"));
  assert.ok(!isValidEmail("a@b"));
});

test("cleanRows: dedupe by phone normalizes first", () => {
  const headers = ["name", "phone"];
  const rows = [["A", "(555) 123-4567"], ["B", "5551234567"], ["C", "5559999999"]];
  const r = cleanRows(headers, rows, { ...ALL_OFF, dedupePhone: true });
  assert.equal(r.out.length, 2);
  assert.equal(r.stats.removed, 1);
  assert.equal(r.phoneCol, 1);
});

test("cleanRows: drop no-contact rows", () => {
  const headers = ["name", "email", "phone"];
  const rows = [["A", "a@b.com", ""], ["B", "", ""], ["C", "", "5551234567"]];
  const r = cleanRows(headers, rows, { ...ALL_OFF, dropNoContact: true });
  assert.equal(r.out.length, 2);
});

test("cleanRows: drop invalid emails + count", () => {
  const headers = ["email"];
  const rows = [["good@x.com"], ["bad"], ["also@y.io"]];
  const r = cleanRows(headers, rows, { ...ALL_OFF, dropInvalidEmail: true });
  assert.equal(r.out.length, 2);
  assert.equal(r.stats.invalidEmails, 1);
});

test("cleanRows: exact dedupe + trim", () => {
  const headers = ["name", "email"];
  const rows = [[" A ", "a@b.com "], ["A", "a@b.com"]];
  const r = cleanRows(headers, rows, { ...ALL_OFF, trim: true, dedupeExact: true });
  assert.equal(r.out.length, 1);
});
