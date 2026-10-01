import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("fetch", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("fetch", testCase, "http-clients", i + 1);
});
