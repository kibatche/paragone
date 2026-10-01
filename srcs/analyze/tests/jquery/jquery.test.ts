import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("jquery", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("jquery", testCase, "jquery", i + 1);
});
