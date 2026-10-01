import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("cookie", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("cookie", testCase, "cookie", i + 1);
});
