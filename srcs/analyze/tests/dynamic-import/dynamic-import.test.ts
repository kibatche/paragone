import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("dynamic-import", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("dynamic-import", testCase, "dynamic-import", i + 1);
});
