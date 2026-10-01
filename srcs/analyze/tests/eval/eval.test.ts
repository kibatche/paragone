import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("eval", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("eval", testCase, "eval", i + 1);
});
