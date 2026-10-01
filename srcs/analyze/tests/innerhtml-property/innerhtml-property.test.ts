import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("innerhtml-property", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("innerhtml-property", testCase, "innerhtml-property", i + 1);
});
