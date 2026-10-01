import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("regex-match", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("regex-match", testCase, "regex-match", i + 1);
});
