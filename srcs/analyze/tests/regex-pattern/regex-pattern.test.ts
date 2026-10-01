import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("regex-pattern", 1),
  },
  {
    jsFileName: "2.js",
    expectedResults: loadExpectedResults("regex-pattern", 2),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("regex-pattern", testCase, "regex", i + 1);
});
