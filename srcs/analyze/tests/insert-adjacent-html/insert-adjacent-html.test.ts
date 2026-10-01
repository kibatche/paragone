import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("insert-adjacent-html", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest(
    "insert-adjacent-html",
    testCase,
    "insert-adjacent-html",
    i + 1,
  );
});
