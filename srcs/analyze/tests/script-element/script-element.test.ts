import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("script-element", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("script-element", testCase, "script-element", i + 1);
});
