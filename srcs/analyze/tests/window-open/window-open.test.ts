import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("window-open", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("window-open", testCase, "window-open", i + 1);
});
