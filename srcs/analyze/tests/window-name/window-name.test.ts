import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("window-name", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("window-name", testCase, "window-name", i + 1);
});
