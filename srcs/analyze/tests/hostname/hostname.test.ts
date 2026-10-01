import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("hostname", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("hostname", testCase, "hostname", i + 1);
});
