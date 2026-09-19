import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../public/script.js", import.meta.url), "utf8");

function setup(valid = true) {
  let submit;
  let validityReports = 0;
  const values = new Map([
    ["name", "Arash Riahi"],
    ["email", "admin@example.com"],
    ["type", "Brand activation"],
    ["date", "2026-10-01"],
    ["location", "Los Angeles"],
    ["guests", "94"],
    ["details", "Coffee and music"]
  ]);
  const form = {
    addEventListener(type, handler) { if (type === "submit") submit = handler; },
    checkValidity: () => valid,
    reportValidity() { validityReports++; }
  };
  const masthead = { offsetHeight: 64, dataset: {} };
  const mobileMenu = { open: false, contains: () => false, querySelector: () => ({ focus() {} }) };
  const location = { search: "", protocol: "https:", href: "https://ninetyfourla.com/" };
  const elements = {
    ".masthead": masthead,
    ".mobile-menu": mobileMenu,
    "[data-collaboration-form]": form
  };
  runInNewContext(source, {
    document: { querySelector: selector => elements[selector], querySelectorAll: () => [], addEventListener() {} },
    window: { innerHeight: 844, innerWidth: 390, location, addEventListener() {} },
    requestAnimationFrame: callback => callback(),
    URLSearchParams,
    FormData: class { get(key) { return values.get(key); } },
    encodeURIComponent
  });
  return { location, masthead, submit: () => submit({ preventDefault() {} }), get validityReports() { return validityReports; } };
}

test("collaboration inquiry composes a transparent mailto draft", () => {
  const page = setup();
  page.submit();
  assert.match(page.location.href, /^mailto:Admin@theninety4\.com\?/);
  assert.match(decodeURIComponent(page.location.href), /Ninety Four collaboration inquiry/);
  assert.match(decodeURIComponent(page.location.href), /Name: Arash Riahi/);
  assert.match(decodeURIComponent(page.location.href), /Approximate guest count: 94/);
});

test("invalid collaboration fields do not open an email draft", () => {
  const page = setup(false);
  page.submit();
  assert.equal(page.location.href, "https://ninetyfourla.com/");
  assert.equal(page.validityReports, 1);
});
