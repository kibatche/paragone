import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("inner-html", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("inner-html", testCase, "inner-html", i + 1);
});
