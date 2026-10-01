import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("worker", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("worker", testCase, "worker", i + 1);
});
