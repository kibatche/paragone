import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("session-storage", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("session-storage", testCase, "session-storage", i + 1);
});
