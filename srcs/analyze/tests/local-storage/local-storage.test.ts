import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("local-storage", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("local-storage", testCase, "local-storage", i + 1);
});
