import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("string-timer", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("string-timer", testCase, "string-timer", i + 1);
});
