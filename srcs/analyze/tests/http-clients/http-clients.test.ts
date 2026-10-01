import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("http-clients", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("http-clients", testCase, "http-clients", i + 1);
});
