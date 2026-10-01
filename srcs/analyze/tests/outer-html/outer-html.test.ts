import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("outer-html", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("outer-html", testCase, "outer-html", i + 1);
});
